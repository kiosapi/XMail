import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getDomains, getAllDomains, addDomain, removeDomain, domainExists,
  getInbox, createInbox, updateInboxExpiry, inboxExists, deleteInbox, getSessionInboxes,
  getMessages, getMessage, insertMessage, deleteMessage,
  markMessageRead, toggleMessageStar, markForwarded, searchMessages,
  ensureSession, linkInboxToSession, unlinkInboxFromSession, isInboxInSession,
  updateInboxLabel, getInboxSettings, setInboxSettings,
  incrementStats, getStatsRange, getTotalCounts,
  deleteExpiredInboxes, pruneOldMessages,
  getBlocklist, addBlocklistEntry, removeBlocklistEntry,
  getAllSettings, setSetting, deleteSetting,
} from '../db/queries';
import { generateUniqueAddress } from '../utils/random-address';

export interface ApiEnv {
  DB: D1Database;
  APP_NAME: string;
  MAIL_DOMAIN: string;
  WEB_HOST: string;
  AUTO_EXPIRY_HOURS: string;
  MAX_MESSAGES_PER_INBOX: string;
  API_KEYS: string;
  ADMIN_KEYS: string;
}

// ---- Helpers ----

function getApiKeys(env: ApiEnv): string[] {
  return (env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
}
function getAdminKeys(env: ApiEnv): string[] {
  return (env.ADMIN_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
}
function sessionId(c: any): string | null {
  return (c.req.header('x-session-id') || '').trim() || null;
}
function requireSession(c: any): string {
  const sid = sessionId(c);
  if (!sid) { c.status(400); return ''; }
  return sid;
}
async function checkApiKey(c: any, env: ApiEnv): Promise<boolean> {
  const dbSettings = await getAllSettings(env.DB).catch(() => ({} as Record<string, string>));
  const keys = (dbSettings.api_keys || env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  const adminKeys = (dbSettings.admin_keys || env.ADMIN_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0 && adminKeys.length === 0) return true;
  const provided = (c.req.header('x-api-key') || c.req.query('key') || '').trim();
  return keys.includes(provided) || adminKeys.includes(provided);
}
async function checkAdminKey(c: any, env: ApiEnv): Promise<boolean> {
  const dbSettings = await getAllSettings(env.DB).catch(() => ({} as Record<string, string>));
  const adminKeys = (dbSettings.admin_keys || env.ADMIN_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  if (adminKeys.length === 0) return checkApiKey(c, env);
  const provided = (c.req.header('x-api-key') || c.req.query('key') || '').trim();
  return adminKeys.includes(provided);
}
function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status);
}

// ---- Router ----

const api = new Hono<{ Bindings: ApiEnv }>();

// CORS
api.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-session-id', 'x-api-key'],
}));

// ---- GET /config ----
api.get('/config', async (c) => {
  const dbDomains = await getDomains(c.env.DB).catch(() => []);
  const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
  const allDomains = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];
  // Merge DB settings (override env)
  const dbSettings = await getAllSettings(c.env.DB).catch(() => ({}));
  const appName = dbSettings.app_name || c.env.APP_NAME || 'XMail';
  const autoExpiry = dbSettings.auto_expiry_hours || c.env.AUTO_EXPIRY_HOURS || '24';
  const maxMsgs = dbSettings.max_messages_per_inbox || c.env.MAX_MESSAGES_PER_INBOX || '100';
  const apiKeys = (dbSettings.api_keys || c.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  const adminKeys = (dbSettings.admin_keys || c.env.ADMIN_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  return c.json({
    appName,
    mailDomain: allDomains[0] || 'example.com',
    mailDomains: allDomains,
    webHost: c.env.WEB_HOST || '',
    authRequired: apiKeys.length > 0,
    autoExpiryHours: autoExpiry,
    maxMessagesPerInbox: maxMsgs,
    hasTgToken: !!(dbSettings.tg_bot_token || (globalThis as any).TG_BOT_TOKEN),
    hasWebhookSecret: !!(dbSettings.webhook_secret || (globalThis as any).WEBHOOK_SECRET),
    tgBotConfigured: !!(dbSettings.tg_bot_token),
    tgWebhookUrl: dbSettings.tg_webhook_url || '',
  });
});

// ---- GET /session ----
api.get('/session', async (c) => {
  let sid = sessionId(c);
  if (!sid) sid = crypto.randomUUID();
  await ensureSession(c.env.DB, sid);
  return c.json({ sessionId: sid });
});

// ==================== Domains ====================

// GET /domains
api.get('/domains', async (c) => {
  const dbDomains = await getDomains(c.env.DB).catch(() => []);
  const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
  const all = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];
  return c.json({ domains: all });
});

// POST /domains (admin)
api.post('/domains', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const body = await c.req.json().catch(() => ({}));
  const domain = (body.domain || '').trim().toLowerCase();
  const label = (body.label || '').trim();
  if (!domain) return jsonError(c, 400, 'Domain required');
  await addDomain(c.env.DB, domain, label);
  return c.json({ ok: true, domain }, 201);
});

// DELETE /domains/:domain (admin)
api.delete('/domains/:domain', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const domain = decodeURIComponent(c.req.param('domain')).toLowerCase();
  await removeDomain(c.env.DB, domain);
  return c.json({ ok: true });
});

// ==================== Inboxes ====================

// GET /inboxes
api.get('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const inboxes = await getSessionInboxes(c.env.DB, sid);
  return c.json(inboxes);
});

// POST /inboxes
api.post('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const body = await c.req.json().catch(() => ({}));

  // Get allowed domains
  const dbDomains = await getDomains(c.env.DB).catch(() => []);
  const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
  const allDomains = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];

  const requestedDomain = (body.domain || '').trim().toLowerCase();
  const domain = requestedDomain && allDomains.includes(requestedDomain) ? requestedDomain : allDomains[0];
  if (!domain) return jsonError(c, 400, 'No domains configured');

  const requested = (body.localPart || '').trim().toLowerCase();
  const label = (body.label || '').trim();
  const expiryHours = parseInt(c.env.AUTO_EXPIRY_HOURS || '0', 10);

  let address: string;
  if (requested) {
    address = `${requested}@${domain}`;
  } else {
    address = await generateUniqueAddress(addr => inboxExists(c.env.DB, addr), domain);
  }

  await createInbox(c.env.DB, address, label, expiryHours);
  await linkInboxToSession(c.env.DB, sid, address);
  await incrementStats(c.env.DB, 'inboxes');
  const inbox = await getInbox(c.env.DB, address);
  return c.json(inbox!, 201);
});

// POST /inboxes/bulk
api.post('/inboxes/bulk', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const body = await c.req.json().catch(() => ({}));
  const count = Math.min(parseInt(body.count || '1', 10) || 1, 100);

  const dbDomains = await getDomains(c.env.DB).catch(() => []);
  const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
  const allDomains = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];
  const requestedDomain = (body.domain || '').trim().toLowerCase();
  const domain = requestedDomain && allDomains.includes(requestedDomain) ? requestedDomain : allDomains[0];

  const expiryHours = parseInt(c.env.AUTO_EXPIRY_HOURS || '0', 10);
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const address = await generateUniqueAddress(addr => inboxExists(c.env.DB, addr), domain);
    await createInbox(c.env.DB, address, '', expiryHours);
    await linkInboxToSession(c.env.DB, sid, address);
    results.push(address);
  }
  await incrementStats(c.env.DB, 'inboxes');
  return c.json({ count: results.length, addresses: results }, 201);
});

// DELETE /inboxes/:address
api.delete('/inboxes/:address', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (c.req.query('purge') === '1') {
    await deleteInbox(c.env.DB, address);
  } else {
    await unlinkInboxFromSession(c.env.DB, sid, address);
  }
  return c.json({ ok: true });
});

// PUT /inboxes/:address/ttl — set custom expiry
api.put('/inboxes/:address/ttl', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const body = await c.req.json().catch(() => ({}));
  const hours = parseInt(body.hours || '0', 10);
  await updateInboxExpiry(c.env.DB, address, hours);
  return c.json({ ok: true, expires_in_hours: hours });
});

// PUT /inboxes/:address/label
api.put('/inboxes/:address/label', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  const body = await c.req.json().catch(() => ({}));
  await updateInboxLabel(c.env.DB, address, body.label || '');
  return c.json({ ok: true });
});

// ==================== Messages ====================

// GET /inboxes/:address/messages
api.get('/inboxes/:address/messages', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const messages = await getMessages(c.env.DB, address);
  return c.json(messages);
});

// GET /inboxes/:address/messages/:id
api.get('/inboxes/:address/messages/:id', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const msg = await getMessage(c.env.DB, c.req.param('id'));
  if (!msg || msg.inbox_address !== address) return jsonError(c, 404, 'Message not found');
  await markMessageRead(c.env.DB, msg.id);
  return c.json(msg);
});

// DELETE /inboxes/:address/messages/:id
api.delete('/inboxes/:address/messages/:id', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  await deleteMessage(c.env.DB, c.req.param('id'));
  return c.json({ ok: true });
});

// PUT /inboxes/:address/messages/:id/star
api.put('/inboxes/:address/messages/:id/star', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const isStarred = await toggleMessageStar(c.env.DB, c.req.param('id'));
  return c.json({ ok: true, is_starred: isStarred });
});

// GET /inboxes/:address/otp
api.get('/inboxes/:address/otp', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const messages = await getMessages(c.env.DB, address, 10);
  for (const msg of messages) {
    if (msg.otp_code) {
      return c.json({ otp: msg.otp_code, message_id: msg.id, from: msg.from_address, subject: msg.subject, received_at: msg.received_at });
    }
  }
  return c.json({ otp: null });
});

// ==================== Settings ====================

api.get('/inboxes/:address/settings', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const settings = await getInboxSettings(c.env.DB, address);
  return c.json(settings || { inbox_address: address, webhook_url: null, telegram_chat_id: null, forward_to: null });
});

api.put('/inboxes/:address/settings', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const body = await c.req.json().catch(() => ({}));
  await setInboxSettings(c.env.DB, address, {
    webhook_url: body.webhook_url ?? null,
    telegram_chat_id: body.telegram_chat_id ?? null,
    forward_to: body.forward_to ?? null,
  });
  const settings = await getInboxSettings(c.env.DB, address);
  return c.json(settings);
});

// ==================== Export ====================

// GET /export — export all inbox addresses as text
api.get('/export', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const inboxes = await getSessionInboxes(c.env.DB, sid);
  const text = inboxes.map(i => i.address).join('\n');
  return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
});

// ==================== Stats ====================

api.get('/stats', async (c) => {
  if (!(await checkApiKey(c, c.env))) return jsonError(c, 401, 'Invalid or missing API key');
  const days = parseInt(c.req.query('days') || '7', 10);
  const [daily, totals] = await Promise.all([getStatsRange(c.env.DB, days), getTotalCounts(c.env.DB)]);
  return c.json({ totals, daily });
});

// ==================== Search ====================

api.get('/search', async (c) => {
  if (!(await checkApiKey(c, c.env))) return jsonError(c, 401, 'Invalid or missing API key');
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json([]);
  const results = await searchMessages(c.env.DB, sid, q);
  return c.json(results);
});

// ==================== Admin ====================

api.post('/admin/expire', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const expired = await deleteExpiredInboxes(c.env.DB);
  const dbSettings = await getAllSettings(c.env.DB).catch(() => ({} as Record<string, string>));
  const maxPerInbox = parseInt(dbSettings.max_messages_per_inbox || c.env.MAX_MESSAGES_PER_INBOX || '0', 10);
  const pruned = await pruneOldMessages(c.env.DB, maxPerInbox);
  return c.json({ expired_inboxes: expired, pruned_messages: pruned });
});

// ==================== Admin Settings ====================
// GET /admin/settings — get all settings
api.get('/admin/settings', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const settings = await getAllSettings(c.env.DB);
  // Also include env fallbacks for display
  return c.json({
    settings,
    env: {
      APP_NAME: c.env.APP_NAME || '',
      MAIL_DOMAIN: c.env.MAIL_DOMAIN || '',
      WEB_HOST: c.env.WEB_HOST || '',
      AUTO_EXPIRY_HOURS: c.env.AUTO_EXPIRY_HOURS || '',
      MAX_MESSAGES_PER_INBOX: c.env.MAX_MESSAGES_PER_INBOX || '',
    }
  });
});

// PUT /admin/settings — update settings
api.put('/admin/settings', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const body = await c.req.json().catch(() => ({}));
  const allowed = [
    'app_name', 'auto_expiry_hours', 'max_messages_per_inbox',
    'api_keys', 'admin_keys',
    'tg_bot_token', 'tg_webhook_url',
    'webhook_secret',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await setSetting(c.env.DB, key, String(body[key]));
    }
  }
  // Delete keys set to empty string
  for (const key of allowed) {
    if (body[key] === '') {
      await deleteSetting(c.env.DB, key);
    }
  }
  return c.json({ ok: true });
});

// POST /admin/tg/setup — set Telegram webhook
api.post('/admin/tg/setup', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const dbSettings = await getAllSettings(c.env.DB);
  const token = dbSettings.tg_bot_token;
  if (!token) return jsonError(c, 400, 'TG_BOT_TOKEN not set. Set it in Admin Panel first.');
  const webhookUrl = `https://${c.env.WEB_HOST}/api/tg/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const data = await res.json();
  await setSetting(c.env.DB, 'tg_webhook_url', webhookUrl);
  return c.json({ ok: data.ok, telegram_response: data, webhook_url: webhookUrl });
});

// GET /health
api.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== Blocklist ====================

// GET /blocklist
api.get('/blocklist', async (c) => {
  if (!(await checkApiKey(c, c.env))) return jsonError(c, 401, 'Invalid or missing API key');
  const scope = c.req.query('scope');
  const entries = await getBlocklist(c.env.DB, scope || undefined);
  return c.json(entries);
});

// POST /blocklist (admin)
api.post('/blocklist', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const body = await c.req.json().catch(() => ({}));
  const pattern = (body.pattern || '').trim();
  const matchType = (body.match_type || 'sender').trim();
  const scope = (body.scope || 'global').trim();
  if (!pattern) return jsonError(c, 400, 'Pattern required');
  if (!['sender', 'subject', 'domain'].includes(matchType)) return jsonError(c, 400, 'Invalid match_type');
  await addBlocklistEntry(c.env.DB, pattern, matchType, scope);
  return c.json({ ok: true }, 201);
});

// DELETE /blocklist/:id (admin)
api.delete('/blocklist/:id', async (c) => {
  if (!(await checkAdminKey(c, c.env))) return jsonError(c, 401, 'Admin key required');
  const id = parseInt(c.req.param('id'), 10);
  await removeBlocklistEntry(c.env.DB, id);
  return c.json({ ok: true });
});

// ==================== Telegram Bot Webhook ====================
// POST /tg/webhook — receives Telegram updates, responds with inbox info
api.post('/tg/webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const dbSettings = await getAllSettings(c.env.DB);
  const tgToken = dbSettings.tg_bot_token || (globalThis as any).TG_BOT_TOKEN;
  if (!tgToken) return c.json({ error: 'TG_BOT_TOKEN not set' }, 500);

  const msg = body.message || body.edited_message;
  if (!msg || !msg.text) return c.json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const tgAdminKey = (globalThis as any).TG_ADMIN_KEY || '';
  // Optional: verify secret in URL path or require TG_ADMIN_KEY
  const adminKeys = getAdminKeys(c.env);
  if (adminKeys.length > 0 && !adminKeys.includes(tgAdminKey)) {
    // If admin keys configured but TG_ADMIN_KEY not set, still allow (backwards compat)
  }

  const db = c.env.DB;

  // Parse commands
  let responseText = '';

  if (text === '/start' || text === '/help') {
    responseText = 'XMail Bot — Commands:\n\n' +
      '/inbox <address> — Latest messages\n' +
      '/otp <address> — Latest OTP code\n' +
      '/domains — List active domains\n' +
      '/create [domain] — Create random inbox\n' +
      '/stats — Show statistics\n' +
      '/help — Show this help';
  } else if (text.startsWith('/inbox ')) {
    const addr = text.slice(8).trim().toLowerCase();
    const msgs = await getMessages(db, addr, 5);
    if (msgs.length === 0) {
      responseText = 'No messages for ' + addr;
    } else {
      responseText = 'Inbox: ' + addr + '\n\n' + msgs.map(m =>
        'From: ' + (m.from_name || m.from_address) + '\n' +
        'Subject: ' + m.subject + '\n' +
        (m.otp_code ? 'OTP: ' + m.otp_code + '\n' : '') +
        'Date: ' + m.received_at
      ).join('\n\n---\n\n');
    }
  } else if (text.startsWith('/otp ')) {
    const addr = text.slice(5).trim().toLowerCase();
    const msgs = await getMessages(db, addr, 10);
    let otp = null;
    for (const m of msgs) { if (m.otp_code) { otp = m; break; } }
    if (otp) {
      responseText = 'OTP for ' + addr + ':\n\nCode: ' + otp.otp_code + '\nFrom: ' + otp.from_address + '\nSubject: ' + otp.subject + '\nReceived: ' + otp.received_at;
    } else {
      responseText = 'No OTP found for ' + addr;
    }
  } else if (text === '/domains') {
    const dbDomains = await getDomains(db).catch(() => []);
    const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
    const all = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];
    responseText = 'Active domains:\n\n' + all.map(d => '• ' + d).join('\n');
  } else if (text.startsWith('/create') || text === '/create') {
    const dbDomains = await getDomains(db).catch(() => []);
    const envDomains = (c.env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
    const all = [...new Set([...dbDomains.map(d => d.domain), ...envDomains])];
    const argDomain = text.slice(8).trim().toLowerCase();
    const domain = argDomain && all.includes(argDomain) ? argDomain : all[0];
    const address = await generateUniqueAddress(addr => inboxExists(db, addr), domain);
    const expiryHours = parseInt(c.env.AUTO_EXPIRY_HOURS || '0', 10);
    await createInbox(db, address, '', expiryHours);
    responseText = 'New inbox created:\n\n' + address + '\n\nExpires in ' + (expiryHours || '∞') + ' hours';
  } else if (text === '/stats') {
    const totals = await getTotalCounts(db);
    responseText = 'XMail Stats:\n\nTotal Inboxes: ' + totals.inboxes + '\nTotal Emails: ' + totals.messages;
  } else {
    responseText = 'Unknown command. Send /help for available commands.';
  }

  // Send response via Telegram API
  await fetch('https://api.telegram.org/bot' + tgToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: responseText, parse_mode: 'HTML' }),
  });

  return c.json({ ok: true });
});

// ==================== QR Code ====================
// GET /inboxes/:address/qr — returns SVG QR code
api.get('/inboxes/:address/qr', async (c) => {
  const address = decodeURIComponent(c.req.param('address'));

  const qr = (await import('qrcode-generator')).default;
  const qr0 = qr(0, 'M');
  qr0.addData(address);
  qr0.make();

  const size = qr0.getModuleCount();
  const cellSize = 8;
  const margin = 2;
  const total = (size + margin * 2) * cellSize;
  const fg = c.req.query('dark') === '0' ? '#ffffff' : '#000000';
  const bg = c.req.query('dark') === '0' ? '#000000' : '#ffffff';

  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c2 = 0; c2 < size; c2++) {
      if (qr0.isDark(r, c2)) {
        rects += `<rect x="${(c2 + margin) * cellSize}" y="${(r + margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}"><rect width="${total}" height="${total}" fill="${bg}"/>${rects}</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
});

// ==================== RSS Feed (#7) ====================
// GET /inboxes/:address/rss — RSS 2.0 feed of inbox messages
api.get('/inboxes/:address/rss', async (c) => {
  const address = decodeURIComponent(c.req.param('address'));
  const apiKey = (c.req.header('x-api-key') || c.req.query('key') || '').trim();
  const keys = getApiKeys(c.env);
  const dbSettingsRss = await getAllSettings(c.env.DB).catch(() => ({} as Record<string, string>));
  const rssKeys = (dbSettingsRss.api_keys || c.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
  if (rssKeys.length > 0 && !rssKeys.includes(apiKey)) {
    return jsonError(c, 401, 'API key required for RSS');
  }
  const messages = await getMessages(c.env.DB, address, 50);
  const pubDate = messages.length > 0 ? new Date(messages[0].received_at.replace(' ', 'T')).toUTCString() : new Date().toUTCString();

  let items = '';
  for (const msg of messages) {
    const dt = new Date(msg.received_at.replace(' ', 'T')).toUTCString();
    const desc = msg.otp_code
      ? `OTP: ${msg.otp_code}\n\n${msg.body_text.slice(0, 500)}`
      : msg.body_text.slice(0, 500);
    items += `<item><title><![CDATA[${msg.subject}]]></title><link>https://${c.env.WEB_HOST}/#msg=${msg.id}</link><description><![CDATA[${desc}]]></description><author>${msg.from_address}</author><pubDate>${dt}</pubDate><guid isPermaLink="false">${msg.id}</guid></item>`;
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>XMail — ${address}</title>
<link>https://${c.env.WEB_HOST}</link>
<description>Disposable inbox feed for ${address}</description>
<language>en</language>
<pubDate>${pubDate}</pubDate>
${items}
</channel></rss>`;

  return new Response(rss, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
});

// ==================== Inbox Reclaim (#8) ====================
// POST /inboxes/claim — reclaim existing inbox by address into current session
api.post('/inboxes/claim', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const body = await c.req.json().catch(() => ({}));
  const address = (body.address || '').trim().toLowerCase();
  if (!address) return jsonError(c, 400, 'Address required');
  const inbox = await getInbox(c.env.DB, address);
  if (!inbox) return jsonError(c, 404, 'Inbox not found');
  await linkInboxToSession(c.env.DB, sid, address);
  return c.json({ ok: true, inbox });
});

// ==================== Message .eml Download (#9) ====================
// GET /inboxes/:address/messages/:id/eml — download message as .eml
api.get('/inboxes/:address/messages/:id/eml', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const address = decodeURIComponent(c.req.param('address'));
  if (!(await isInboxInSession(c.env.DB, sid, address))) return jsonError(c, 403, 'Inbox not in session');
  const msg = await getMessage(c.env.DB, c.req.param('id'));
  if (!msg || msg.inbox_address !== address) return jsonError(c, 404, 'Message not found');

  const date = new Date(msg.received_at.replace(' ', 'T')).toUTCString();
  const eml = [
    `From: ${msg.from_name ? `"${msg.from_name}" ` : ''}<${msg.from_address}>`,
    `To: <${msg.inbox_address}>`,
    `Subject: ${msg.subject}`,
    `Date: ${date}`,
    `Message-ID: <${msg.id}@${c.env.WEB_HOST}>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    msg.body_text,
  ].join('\r\n');

  return new Response(eml, {
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="${msg.id}.eml"`,
    },
  });
});

// ==================== Webhook HMAC Signing (#10) ====================
// Webhook helper — signs payload with HMAC-SHA256 using WEBHOOK_SECRET
async function signWebhook(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export { signWebhook };

export default api;
