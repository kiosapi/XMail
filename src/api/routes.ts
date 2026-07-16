import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getInbox,
  createInbox,
  inboxExists,
  deleteInbox,
  getSessionInboxes,
  getMessages,
  getMessage,
  ensureSession,
  linkInboxToSession,
  unlinkInboxFromSession,
  isInboxInSession,
  markMessageRead,
  getInboxSettings,
  setInboxSettings,
  incrementStats,
  getStatsRange,
  getTotalCounts,
  deleteExpiredInboxes,
  pruneOldMessages,
} from '../db/queries';
import { generateUniqueAddress } from '../utils/random-address';

export interface ApiEnv {
  DB: D1Database;
  APP_NAME: string;
  MAIL_DOMAIN: string;
  WEB_HOST: string;
  AUTO_EXPIRY_HOURS: string;
  MAX_MESSAGES_PER_INBOX: string;
  API_KEYS: string; // comma-separated, empty = no auth
}

// ---- Helpers ----

function getDomains(env: ApiEnv): string[] {
  return env.MAIL_DOMAIN.split(',').map((d) => d.trim()).filter(Boolean);
}

function defaultDomain(env: ApiEnv): string {
  return getDomains(env)[0] || 'example.com';
}

function getApiKeys(env: ApiEnv): string[] {
  return (env.API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function sessionId(c: any): string | null {
  return (c.req.header('x-session-id') || '').trim() || null;
}

function requireSession(c: any): string {
  const sid = sessionId(c);
  if (!sid) {
    c.status(400);
    return '';
  }
  return sid;
}

/** API key auth middleware. Skips if no keys configured. */
function checkApiKey(c: any, env: ApiEnv): boolean {
  const keys = getApiKeys(env);
  if (keys.length === 0) return true; // auth disabled

  const provided = (c.req.header('x-api-key') || c.req.query('key') || '').trim();
  return keys.includes(provided);
}

function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status);
}

// ---- Router ----

const api = new Hono<{ Bindings: ApiEnv }>();

// ---- GET /config ----
api.get('/config', (c) => {
  const domains = getDomains(c.env);
  return c.json({
    appName: c.env.APP_NAME || 'XMail',
    mailDomain: domains[0] || 'example.com',
    mailDomains: domains,
    webHost: c.env.WEB_HOST || 'mail.example.com',
    authRequired: getApiKeys(c.env).length > 0,
  });
});

// ---- GET /session ----
api.get('/session', async (c) => {
  let sid = sessionId(c);
  if (!sid) {
    sid = crypto.randomUUID();
  }
  await ensureSession(c.env.DB, sid);
  return c.json({ sessionId: sid });
});

// ---- GET /inboxes ----
api.get('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const inboxes = await getSessionInboxes(c.env.DB, sid);
  return c.json(inboxes);
});

// ---- POST /inboxes ----
api.post('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const body = await c.req.json().catch(() => ({}));
  const domains = getDomains(c.env);
  const requestedDomain: string = (body.domain || '').trim().toLowerCase();
  const domain = requestedDomain && domains.includes(requestedDomain) ? requestedDomain : defaultDomain(c.env);

  if (requestedDomain && !domains.includes(requestedDomain)) {
    return jsonError(c, 400, `Invalid domain: ${requestedDomain}. Allowed: ${domains.join(', ')}`);
  }

  const requested: string = (body.localPart || '').trim().toLowerCase();
  const label: string = (body.label || '').trim();
  const expiryHours = parseInt(c.env.AUTO_EXPIRY_HOURS || '0', 10);

  let address: string;
  if (requested) {
    address = `${requested}@${domain}`;
  } else {
    address = await generateUniqueAddress((addr) => inboxExists(c.env.DB, addr), domain);
  }

  await createInbox(c.env.DB, address, label, expiryHours);
  await linkInboxToSession(c.env.DB, sid, address);
  await incrementStats(c.env.DB, 'inboxes');

  const inbox = await getInbox(c.env.DB, address);
  return c.json(inbox!, 201);
});

// ---- POST /inboxes/bulk ----
api.post('/inboxes/bulk', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const body = await c.req.json().catch(() => ({}));
  const count = Math.min(parseInt(body.count || '1', 10) || 1, 100);
  const domains = getDomains(c.env);
  const requestedDomain: string = (body.domain || '').trim().toLowerCase();
  const domain = requestedDomain && domains.includes(requestedDomain) ? requestedDomain : defaultDomain(c.env);
  const expiryHours = parseInt(c.env.AUTO_EXPIRY_HOURS || '0', 10);

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const address = await generateUniqueAddress((addr) => inboxExists(c.env.DB, addr), domain);
    await createInbox(c.env.DB, address, '', expiryHours);
    await linkInboxToSession(c.env.DB, sid, address);
    results.push(address);
  }
  await incrementStats(c.env.DB, 'inboxes');
  return c.json({ count: results.length, addresses: results }, 201);
});

// ---- DELETE /inboxes/:address ----
api.delete('/inboxes/:address', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  // If query param purge=1, delete inbox + messages entirely
  if (c.req.query('purge') === '1') {
    await deleteInbox(c.env.DB, address);
  } else {
    await unlinkInboxFromSession(c.env.DB, sid, address);
  }
  return c.json({ ok: true });
});

// ---- GET /inboxes/:address/messages ----
api.get('/inboxes/:address/messages', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return jsonError(c, 403, 'Inbox not in this session');
  }

  const messages = await getMessages(c.env.DB, address);
  return c.json(messages);
});

// ---- GET /inboxes/:address/messages/:id ----
api.get('/inboxes/:address/messages/:id', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return jsonError(c, 403, 'Inbox not in this session');
  }

  const msgId = c.req.param('id');
  const msg = await getMessage(c.env.DB, msgId);
  if (!msg || msg.inbox_address !== address) {
    return jsonError(c, 404, 'Message not found');
  }

  await markMessageRead(c.env.DB, msgId);
  return c.json(msg);
});

// ---- GET /inboxes/:address/otp ----
// Returns latest OTP code for this inbox
api.get('/inboxes/:address/otp', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return jsonError(c, 403, 'Inbox not in this session');
  }

  const messages = await getMessages(c.env.DB, address, 10);
  for (const msg of messages) {
    if (msg.otp_code) {
      return c.json({
        otp: msg.otp_code,
        message_id: msg.id,
        from: msg.from_address,
        subject: msg.subject,
        received_at: msg.received_at,
      });
    }
  }
  return c.json({ otp: null });
});

// ---- GET /inboxes/:address/settings ----
api.get('/inboxes/:address/settings', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return jsonError(c, 403, 'Inbox not in this session');
  }

  const settings = await getInboxSettings(c.env.DB, address);
  return c.json(settings || { inbox_address: address, webhook_url: null, telegram_chat_id: null });
});

// ---- PUT /inboxes/:address/settings ----
api.put('/inboxes/:address/settings', async (c) => {
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 25, 'Missing x-session-id');

  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return jsonError(c, 403, 'Inbox not in this session');
  }

  const body = await c.req.json().catch(() => ({}));
  await setInboxSettings(c.env.DB, address, {
    webhook_url: body.webhook_url ?? null,
    telegram_chat_id: body.telegram_chat_id ?? null,
  });
  const settings = await getInboxSettings(c.env.DB, address);
  return c.json(settings);
});

// ---- GET /stats ----
api.get('/stats', async (c) => {
  if (!checkApiKey(c, c.env)) {
    return jsonError(c, 401, 'Invalid or missing API key');
  }

  const days = parseInt(c.req.query('days') || '7', 10);
  const [daily, totals] = await Promise.all([
    getStatsRange(c.env.DB, days),
    getTotalCounts(c.env.DB),
  ]);
  return c.json({ totals, daily });
});

// ---- GET /search?q=... ----
api.get('/search', async (c) => {
  if (!checkApiKey(c, c.env)) {
    return jsonError(c, 401, 'Invalid or missing API key');
  }

  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');

  const q = (c.req.query('q') || '').trim().toLowerCase();
  if (!q) return c.json([]);

  const inboxes = await getSessionInboxes(c.env.DB, sid);
  const results: any[] = [];

  for (const inbox of inboxes) {
    const messages = await getMessages(c.env.DB, inbox.address, 50);
    for (const msg of messages) {
      if (
        msg.subject.toLowerCase().includes(q) ||
        msg.from_address.toLowerCase().includes(q) ||
        msg.body_text.toLowerCase().includes(q)
      ) {
        results.push({
          inbox: inbox.address,
          message_id: msg.id,
          from: msg.from_address,
          subject: msg.subject,
          received_at: msg.received_at,
          otp_code: msg.otp_code,
        });
      }
    }
  }

  return c.json(results.slice(0, 100));
});

// ---- POST /admin/expire (manual trigger) ----
api.post('/admin/expire', async (c) => {
  if (!checkApiKey(c, c.env)) {
    return jsonError(c, 401, 'Invalid or missing API key');
  }

  const expiredInboxes = await deleteExpiredInboxes(c.env.DB);
  const maxPerInbox = parseInt(c.env.MAX_MESSAGES_PER_INBOX || '0', 10);
  const prunedMessages = await pruneOldMessages(c.env.DB, maxPerInbox);

  return c.json({
    expired_inboxes: expiredInboxes,
    pruned_messages: prunedMessages,
  });
});

export default api;
