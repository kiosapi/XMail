import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getDomains, getAllDomains, addDomain, removeDomain, domainExists,
  getInbox, createInbox, inboxExists, deleteInbox, getSessionInboxes,
  getMessages, getMessage, insertMessage, deleteMessage,
  markMessageRead, toggleMessageStar, markForwarded, searchMessages,
  ensureSession, linkInboxToSession, unlinkInboxFromSession, isInboxInSession,
  updateInboxLabel, getInboxSettings, setInboxSettings,
  incrementStats, getStatsRange, getTotalCounts,
  deleteExpiredInboxes, pruneOldMessages,
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
function checkApiKey(c: any, env: ApiEnv): boolean {
  const keys = getApiKeys(env);
  if (keys.length === 0) return true;
  const provided = (c.req.header('x-api-key') || c.req.query('key') || '').trim();
  return keys.includes(provided) || getAdminKeys(env).includes(provided);
}
function checkAdminKey(c: any, env: ApiEnv): boolean {
  const adminKeys = getAdminKeys(env);
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
  return c.json({
    appName: c.env.APP_NAME || 'XMail',
    mailDomain: allDomains[0] || 'example.com',
    mailDomains: allDomains,
    webHost: c.env.WEB_HOST || '',
    authRequired: getApiKeys(c.env).length > 0,
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
  if (!checkAdminKey(c, c.env)) return jsonError(c, 401, 'Admin key required');
  const body = await c.req.json().catch(() => ({}));
  const domain = (body.domain || '').trim().toLowerCase();
  const label = (body.label || '').trim();
  if (!domain) return jsonError(c, 400, 'Domain required');
  await addDomain(c.env.DB, domain, label);
  return c.json({ ok: true, domain }, 201);
});

// DELETE /domains/:domain (admin)
api.delete('/domains/:domain', async (c) => {
  if (!checkAdminKey(c, c.env)) return jsonError(c, 401, 'Admin key required');
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
  if (!checkApiKey(c, c.env)) return jsonError(c, 401, 'Invalid or missing API key');
  const days = parseInt(c.req.query('days') || '7', 10);
  const [daily, totals] = await Promise.all([getStatsRange(c.env.DB, days), getTotalCounts(c.env.DB)]);
  return c.json({ totals, daily });
});

// ==================== Search ====================

api.get('/search', async (c) => {
  if (!checkApiKey(c, c.env)) return jsonError(c, 401, 'Invalid or missing API key');
  const sid = requireSession(c);
  if (!sid) return jsonError(c, 400, 'Missing x-session-id');
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json([]);
  const results = await searchMessages(c.env.DB, sid, q);
  return c.json(results);
});

// ==================== Admin ====================

api.post('/admin/expire', async (c) => {
  if (!checkAdminKey(c, c.env)) return jsonError(c, 401, 'Admin key required');
  const expired = await deleteExpiredInboxes(c.env.DB);
  const maxPerInbox = parseInt(c.env.MAX_MESSAGES_PER_INBOX || '0', 10);
  const pruned = await pruneOldMessages(c.env.DB, maxPerInbox);
  return c.json({ expired_inboxes: expired, pruned_messages: pruned });
});

// GET /health
api.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default api;
