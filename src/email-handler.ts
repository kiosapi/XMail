import PostalMime from 'postal-mime';
import type { D1Database } from '@cloudflare/workers-types';
import {
  createInbox, inboxExists, insertMessage, touchInboxEmailTime,
  getInboxSettings, markForwarded, incrementStats, isBlocked,
} from './db/queries';
import { extractOTP } from './utils/otp';

export interface EmailHandlerEnv {
  DB: D1Database;
  MAIL_DOMAIN: string;
  AUTO_EXPIRY_HOURS: string;
  MAX_MESSAGES_PER_INBOX: string;
  WEBHOOK_SECRET: string;
}

interface AttachmentInfo {
  filename: string;
  size: number;
  contentType: string;
}

export async function handleEmail(message: ForwardableEmailMessage, env: EmailHandlerEnv): Promise<void> {
  const to = message.to.toLowerCase();
  const from = message.from.toLowerCase();

  console.log(`[xmail] Received from=${from} to=${to}`);

  try {
    const rawStream = message.raw;
    const parser = new PostalMime();
    const parsed = await parser.parse(rawStream);

    const subject = parsed.subject || '(no subject)';
    const bodyText = parsed.text?.trim() || '';
    const bodyHtml = parsed.html || '';
    const fromName = parsed.from?.name || '';

    // Spam filter — check blocklist before processing
    const blocked = await isBlocked(db, from, subject, to);
    if (blocked) {
      console.log(`[xmail] Blocked email from=${from} to=${to} (matched blocklist)`);
      return;
    }

    const otpCode = extractOTP(subject, bodyText);

    const attachments: AttachmentInfo[] = (parsed.attachments || []).map(a => ({
      filename: a.filename || 'unnamed',
      size: a.content?.length || 0,
      contentType: a.mimeType || 'application/octet-stream',
    }));

    const db = env.DB;
    const expiryHours = parseInt(env.AUTO_EXPIRY_HOURS || '0', 10);

    if (!(await inboxExists(db, to))) {
      await createInbox(db, to, '', expiryHours);
      await incrementStats(db, 'inboxes');
      console.log(`[xmail] Created new inbox: ${to} (expires in ${expiryHours}h)`);
    }

    const msgId = `msg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await insertMessage(db, {
      id: msgId, inbox_address: to, from_address: from, from_name: fromName,
      subject, body_text: bodyText, body_html: bodyHtml, otp_code: otpCode,
      attachments: JSON.stringify(attachments),
    });

    await touchInboxEmailTime(db, to);
    await incrementStats(db, 'emails');

    console.log(`[xmail] Stored message ${msgId} for ${to}${otpCode ? ` (OTP: ${otpCode})` : ''}`);

    const settings = await getInboxSettings(db, to);
    if (settings) {
      // Webhook (with HMAC signing if WEBHOOK_SECRET set)
      if (settings.webhook_url) {
        try {
          const payload = JSON.stringify({
            event: 'email.received', inbox: to,
            message: { id: msgId, from, from_name: fromName, subject, otp_code: otpCode, received_at: new Date().toISOString() },
          });
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const whSecret = (env as any).WEBHOOK_SECRET;
          if (whSecret) {
            const sig = await hmacSha256(payload, whSecret);
            headers['X-XMail-Signature'] = `sha256=${sig}`;
          }
          await fetch(settings.webhook_url, { method: 'POST', headers, body: payload });
          await markForwarded(db, msgId);
        } catch (err) { console.error(`[xmail] Webhook failed for ${to}:`, err); }
      }

      // Telegram
      if (settings.telegram_chat_id) {
        try {
          await sendTelegramNotification(settings.telegram_chat_id, to, {
            id: msgId, from, from_name: fromName, subject, body_text: bodyText, otp_code: otpCode,
          });
          await markForwarded(db, msgId);
        } catch (err) { console.error(`[xmail] Telegram failed for ${to}:`, err); }
      }

      // Forward to another address
      if (settings.forward_to) {
        try {
          await message.forward(settings.forward_to);
          await markForwarded(db, msgId);
          console.log(`[xmail] Forwarded to ${settings.forward_to}`);
        } catch (err) { console.error(`[xmail] Forward failed for ${to}:`, err); }
      }
    }
  } catch (err) {
    console.error(`[xmail] Failed to process email for ${to}:`, err);
  }
}

async function sendTelegramNotification(chatId: string, inbox: string, msg: {
  id: string; from: string; from_name: string; subject: string; body_text: string; otp_code: string | null;
}): Promise<void> {
  const botToken = (globalThis as any).TG_BOT_TOKEN;
  if (!botToken) { console.warn('[xmail] TG_BOT_TOKEN not set'); return; }

  const otpLine = msg.otp_code ? `\n🔐 **OTP:** \`${msg.otp_code}\`` : '';
  const preview = msg.body_text.slice(0, 200);
  const text = `📬 **New Email**\n\n**To:** ${inbox}\n**From:** ${msg.from_name || msg.from}\n**Subject:** ${msg.subject}${otpLine}\n\n\`\`\`\n${preview}\n\`\`\``;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

// ---- HMAC-SHA256 helper (#10 webhook signing) ----
async function hmacSha256(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
