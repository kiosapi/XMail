import PostalMime from 'postal-mime';
import type { D1Database } from '@cloudflare/workers-types';
import {
  createInbox,
  inboxExists,
  insertMessage,
  touchInboxEmailTime,
  getInboxSettings,
  markForwarded,
  incrementStats,
} from './db/queries';
import { extractOTP } from './utils/otp';

export interface EmailHandlerEnv {
  DB: D1Database;
  MAIL_DOMAIN: string;
  AUTO_EXPIRY_HOURS: string;
  MAX_MESSAGES_PER_INBOX: string;
}

interface AttachmentInfo {
  filename: string;
  size: number;
  contentType: string;
}

/**
 * Handles inbound email via Cloudflare Email Worker.
 * Called for every email received at any @<MAIL_DOMAIN> address.
 *
 * Enhanced features:
 * - Extracts OTP codes from subject/body
 * - Stores both text + HTML body
 * - Captures attachment metadata (name, size, type)
 * - Fires webhook if configured per-inbox
 * - Sends Telegram notification if configured
 */
export async function handleEmail(message: ForwardableEmailMessage, env: EmailHandlerEnv): Promise<void> {
  const to = message.to.toLowerCase();
  const from = message.from.toLowerCase();

  console.log(`[xmail] Received from=${from} to=${to}`);

  try {
    // Read raw email
    const rawStream = message.raw;
    const parser = new PostalMime();
    const parsed = await parser.parse(rawStream);

    const subject = parsed.subject || '(no subject)';
    const bodyText = parsed.text?.trim() || '';
    const bodyHtml = parsed.html || '';
    const fromName = parsed.from?.name || '';

    // Extract OTP
    const otpCode = extractOTP(subject, bodyText);

    // Capture attachment metadata
    const attachments: AttachmentInfo[] = (parsed.attachments || []).map((a) => ({
      filename: a.filename || 'unnamed',
      size: a.content?.length || 0,
      contentType: a.mimeType || 'application/octet-stream',
    }));

    const db = env.DB;
    const expiryHours = parseInt(env.AUTO_EXPIRY_HOURS || '0', 10);

    // Auto-create inbox if doesn't exist
    if (!(await inboxExists(db, to))) {
      await createInbox(db, to, '', expiryHours);
      await incrementStats(db, 'inboxes');
      console.log(`[xmail] Created new inbox: ${to} (expires in ${expiryHours}h)`);
    }

    // Store the message
    const msgId = `msg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await insertMessage(db, {
      id: msgId,
      inbox_address: to,
      from_address: from,
      from_name: fromName,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      otp_code: otpCode,
      attachments: JSON.stringify(attachments),
    });

    // Update inbox last_email_at
    await touchInboxEmailTime(db, to);
    await incrementStats(db, 'emails');

    console.log(`[xmail] Stored message ${msgId} for ${to}${otpCode ? ` (OTP: ${otpCode})` : ''}`);

    // Fire webhook + Telegram notification
    const settings = await getInboxSettings(db, to);
    if (settings) {
      // Webhook
      if (settings.webhook_url) {
        try {
          await fetch(settings.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'email.received',
              inbox: to,
              message: {
                id: msgId,
                from: from,
                from_name: fromName,
                subject,
                otp_code: otpCode,
                received_at: new Date().toISOString(),
              },
            }),
          });
          await markForwarded(db, msgId);
          console.log(`[xmail] Webhook fired for ${to}`);
        } catch (err) {
          console.error(`[xmail] Webhook failed for ${to}:`, err);
        }
      }

      // Telegram notification
      if (settings.telegram_chat_id) {
        try {
          await sendTelegramNotification(settings.telegram_chat_id, to, {
            id: msgId,
            from,
            from_name: fromName,
            subject,
            body_text: bodyText,
            otp_code: otpCode,
          });
          await markForwarded(db, msgId);
          console.log(`[xmail] Telegram sent for ${to}`);
        } catch (err) {
          console.error(`[xmail] Telegram failed for ${to}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`[xmail] Failed to process email for ${to}:`, err);
  }
}

/**
 * Send Telegram notification about new email.
 * Uses the Telegram Bot API.
 */
async function sendTelegramNotification(
  chatId: string,
  inbox: string,
  msg: {
    id: string;
    from: string;
    from_name: string;
    subject: string;
    body_text: string;
    otp_code: string | null;
  }
): Promise<void> {
  // TG_BOT_TOKEN must be set as a secret
  const botToken = (globalThis as any).TG_BOT_TOKEN;
  if (!botToken) {
    console.warn('[xmail] TG_BOT_TOKEN not set, skipping Telegram notification');
    return;
  }

  const otpLine = msg.otp_code ? `\n🔐 **OTP:** \`${msg.otp_code}\`` : '';
  const preview = msg.body_text.slice(0, 200);

  const text = `📬 **New Email**\n\n**To:** ${inbox}\n**From:** ${msg.from_name || msg.from}\n**Subject:** ${msg.subject}${otpLine}\n\n\`\`\`\n${preview}\n\`\`\``;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}
