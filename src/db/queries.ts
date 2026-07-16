import type { D1Database } from '@cloudflare/workers-types';

// ---- Types ----

export interface Domain {
  domain: string;
  label: string;
  is_active: number;
  created_at: string;
}

export interface Inbox {
  address: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  last_email_at: string | null;
}

export interface Message {
  id: string;
  inbox_address: string;
  from_address: string;
  from_name: string;
  subject: string;
  body_text: string;
  body_html: string;
  otp_code: string | null;
  attachments: string;
  received_at: string;
  is_read: number;
  is_starred: number;
  forwarded: number;
}

export interface Session {
  id: string;
  created_at: string;
}

export interface InboxSettings {
  inbox_address: string;
  webhook_url: string | null;
  telegram_chat_id: string | null;
  forward_to: string | null;
}

// ---- Domains ----

export async function getDomains(db: D1Database): Promise<Domain[]> {
  return db.prepare('SELECT * FROM domains WHERE is_active = 1 ORDER BY created_at ASC').all<Domain>().then(r => r.results);
}

export async function getAllDomains(db: D1Database): Promise<Domain[]> {
  return db.prepare('SELECT * FROM domains ORDER BY created_at ASC').all<Domain>().then(r => r.results);
}

export async function addDomain(db: D1Database, domain: string, label = ''): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO domains (domain, label, is_active) VALUES (?, ?, 1)').bind(domain.toLowerCase(), label).run();
}

export async function removeDomain(db: D1Database, domain: string): Promise<void> {
  await db.prepare('UPDATE domains SET is_active = 0 WHERE domain = ?').bind(domain.toLowerCase()).run();
}

export async function domainExists(db: D1Database, domain: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM domains WHERE domain = ? AND is_active = 1 LIMIT 1').bind(domain.toLowerCase()).first();
  return !!row;
}

// ---- Inboxes ----

export async function getInbox(db: D1Database, address: string): Promise<Inbox | null> {
  return db.prepare('SELECT * FROM inboxes WHERE address = ?').bind(address).first<Inbox>();
}

export async function createInbox(db: D1Database, address: string, label = '', expiryHours = 0): Promise<void> {
  const expiresAt = expiryHours > 0
    ? new Date(Date.now() + expiryHours * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
    : null;
  await db.prepare('INSERT OR IGNORE INTO inboxes (address, label, expires_at) VALUES (?, ?, ?)').bind(address, label, expiresAt).run();
}

export async function updateInboxExpiry(db: D1Database, address: string, expiryHours: number): Promise<void> {
  const expiresAt = expiryHours > 0
    ? new Date(Date.now() + expiryHours * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
    : null;
  await db.prepare('UPDATE inboxes SET expires_at = ? WHERE address = ?').bind(expiresAt, address).run();
}

export async function inboxExists(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM inboxes WHERE address = ? LIMIT 1').bind(address).first();
  return !!row;
}

export async function getSessionInboxes(db: D1Database, sessionId: string): Promise<Inbox[]> {
  return db.prepare(
    `SELECT i.* FROM inboxes i
     INNER JOIN session_inboxes si ON si.inbox_address = i.address
     WHERE si.session_id = ?
     ORDER BY i.created_at DESC`
  ).bind(sessionId).all<Inbox>().then(r => r.results);
}

export async function deleteInbox(db: D1Database, address: string): Promise<void> {
  await db.prepare('DELETE FROM inboxes WHERE address = ?').bind(address).run();
}

export async function updateInboxLabel(db: D1Database, address: string, label: string): Promise<void> {
  await db.prepare('UPDATE inboxes SET label = ? WHERE address = ?').bind(label, address).run();
}

export async function touchInboxEmailTime(db: D1Database, address: string): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db.prepare('UPDATE inboxes SET last_email_at = ? WHERE address = ?').bind(now, address).run();
}

// ---- Messages ----

export async function getMessages(db: D1Database, inboxAddress: string, limit = 50): Promise<Message[]> {
  return db.prepare('SELECT * FROM messages WHERE inbox_address = ? ORDER BY received_at DESC LIMIT ?').bind(inboxAddress, limit).all<Message>().then(r => r.results);
}

export async function getMessage(db: D1Database, msgId: string): Promise<Message | null> {
  return db.prepare('SELECT * FROM messages WHERE id = ?').bind(msgId).first<Message>();
}

export async function insertMessage(
  db: D1Database,
  msg: {
    id: string;
    inbox_address: string;
    from_address: string;
    from_name: string;
    subject: string;
    body_text: string;
    body_html: string;
    otp_code: string | null;
    attachments: string;
  }
): Promise<void> {
  await db.prepare(
    `INSERT INTO messages (id, inbox_address, from_address, from_name, subject, body_text, body_html, otp_code, attachments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(msg.id, msg.inbox_address, msg.from_address, msg.from_name, msg.subject, msg.body_text, msg.body_html, msg.otp_code, msg.attachments).run();
}

export async function deleteMessage(db: D1Database, msgId: string): Promise<void> {
  await db.prepare('DELETE FROM messages WHERE id = ?').bind(msgId).run();
}

export async function markMessageRead(db: D1Database, msgId: string): Promise<void> {
  await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(msgId).run();
}

export async function toggleMessageStar(db: D1Database, msgId: string): Promise<boolean> {
  await db.prepare('UPDATE messages SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE id = ?').bind(msgId).run();
  const msg = await getMessage(db, msgId);
  return msg?.is_starred === 1;
}

export async function markForwarded(db: D1Database, msgId: string): Promise<void> {
  await db.prepare('UPDATE messages SET forwarded = 1 WHERE id = ?').bind(msgId).run();
}

export async function searchMessages(db: D1Database, sessionId: string, q: string): Promise<any[]> {
  const inboxes = await getSessionInboxes(db, sessionId);
  const results: any[] = [];
  for (const ib of inboxes) {
    const msgs = await db.prepare(
      `SELECT * FROM messages WHERE inbox_address = ? AND (subject LIKE ? OR from_address LIKE ? OR body_text LIKE ?) ORDER BY received_at DESC LIMIT 20`
    ).bind(ib.address, `%${q}%`, `%${q}%`, `%${q}%`).all<Message>().then(r => r.results);
    for (const m of msgs) {
      results.push({ inbox: ib.address, message_id: m.id, from: m.from_address, subject: m.subject, received_at: m.received_at, otp_code: m.otp_code, is_read: m.is_read });
    }
  }
  return results.slice(0, 100);
}

// ---- Sessions ----

export async function ensureSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').bind(sessionId).run();
}

// ---- Session-Inbox links ----

export async function linkInboxToSession(db: D1Database, sessionId: string, address: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO session_inboxes (session_id, inbox_address) VALUES (?, ?)').bind(sessionId, address).run();
}

export async function unlinkInboxFromSession(db: D1Database, sessionId: string, address: string): Promise<void> {
  await db.prepare('DELETE FROM session_inboxes WHERE session_id = ? AND inbox_address = ?').bind(sessionId, address).run();
}

export async function isInboxInSession(db: D1Database, sessionId: string, address: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM session_inboxes WHERE session_id = ? AND inbox_address = ? LIMIT 1').bind(sessionId, address).first();
  return !!row;
}

// ---- Inbox Settings ----

export async function getInboxSettings(db: D1Database, address: string): Promise<InboxSettings | null> {
  return db.prepare('SELECT * FROM inbox_settings WHERE inbox_address = ?').bind(address).first<InboxSettings>();
}

export async function setInboxSettings(
  db: D1Database, address: string,
  settings: { webhook_url?: string | null; telegram_chat_id?: string | null; forward_to?: string | null }
): Promise<void> {
  await db.prepare(
    `INSERT INTO inbox_settings (inbox_address, webhook_url, telegram_chat_id, forward_to)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(inbox_address) DO UPDATE SET
       webhook_url = COALESCE(excluded.webhook_url, inbox_settings.webhook_url),
       telegram_chat_id = COALESCE(excluded.telegram_chat_id, inbox_settings.telegram_chat_id),
       forward_to = COALESCE(excluded.forward_to, inbox_settings.forward_to)`
  ).bind(address, settings.webhook_url ?? null, settings.telegram_chat_id ?? null, settings.forward_to ?? null).run();
}

// ---- Stats ----

export async function incrementStats(db: D1Database, type: 'emails' | 'inboxes'): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const col = type === 'emails' ? 'total_emails' : 'total_inboxes';
  await db.prepare(
    `INSERT INTO stats (date, total_emails, total_inboxes) VALUES (?, 0, 0)
     ON CONFLICT(date) DO UPDATE SET ${col} = ${col} + 1`
  ).bind(today).run();
}

export async function getStatsRange(db: D1Database, days = 7): Promise<{ date: string; total_emails: number; total_inboxes: number }[]> {
  return db.prepare('SELECT * FROM stats ORDER BY date DESC LIMIT ?').bind(days).all<{ date: string; total_emails: number; total_inboxes: number }>().then(r => r.results);
}

export async function getTotalCounts(db: D1Database): Promise<{ inboxes: number; messages: number }> {
  const inboxes = await db.prepare('SELECT COUNT(*) as c FROM inboxes').first<{ c: number }>();
  const messages = await db.prepare('SELECT COUNT(*) as c FROM messages').first<{ c: number }>();
  return { inboxes: inboxes?.c ?? 0, messages: messages?.c ?? 0 };
}

// ---- Auto-expiry ----

export async function deleteExpiredInboxes(db: D1Database): Promise<number> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const result = await db.prepare('DELETE FROM inboxes WHERE expires_at IS NOT NULL AND expires_at < ?').bind(now).run();
  return result.meta?.changes ?? 0;
}

export async function pruneOldMessages(db: D1Database, maxPerInbox: number): Promise<number> {
  if (maxPerInbox <= 0) return 0;
  const result = await db.prepare(
    `DELETE FROM messages WHERE id NOT IN (
       SELECT id FROM messages m2
       WHERE m2.inbox_address = messages.inbox_address
       ORDER BY received_at DESC LIMIT ?
     )`
  ).bind(maxPerInbox).run();
  return result.meta?.changes ?? 0;
}

// ---- Blocklist (spam filter) ----

export interface BlocklistEntry {
  id: number;
  pattern: string;
  match_type: string; // 'sender' | 'subject' | 'domain'
  scope: string;      // 'global' | inbox address
  created_at: string;
}

export async function getBlocklist(db: D1Database, scope?: string): Promise<BlocklistEntry[]> {
  if (scope) {
    return db.prepare('SELECT * FROM blocklist WHERE scope = ? OR scope = ? ORDER BY created_at DESC').bind(scope, 'global').all<BlocklistEntry>().then(r => r.results);
  }
  return db.prepare('SELECT * FROM blocklist ORDER BY created_at DESC').all<BlocklistEntry>().then(r => r.results);
}

export async function addBlocklistEntry(db: D1Database, pattern: string, matchType: string, scope: string): Promise<void> {
  await db.prepare('INSERT INTO blocklist (pattern, match_type, scope) VALUES (?, ?, ?)').bind(pattern.toLowerCase(), matchType, scope).run();
}

export async function removeBlocklistEntry(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM blocklist WHERE id = ?').bind(id).run();
}

export async function isBlocked(db: D1Database, fromAddress: string, subject: string, inboxAddress: string): Promise<boolean> {
  const entries = await db.prepare('SELECT * FROM blocklist WHERE scope = ? OR scope = ?').bind('global', inboxAddress).all<BlocklistEntry>().then(r => r.results);
  const from = fromAddress.toLowerCase();
  const subj = subject.toLowerCase();
  const fromDomain = from.split('@')[1] || '';

  for (const entry of entries) {
    const pat = entry.pattern.toLowerCase();
    if (entry.match_type === 'sender') {
      // Wildcard match: *@domain.com, user@*, exact, partial
      if (pat.includes('*')) {
        const regex = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(from)) return true;
      } else {
        if (from.includes(pat)) return true;
      }
    } else if (entry.match_type === 'domain') {
      if (fromDomain === pat || fromDomain.endsWith('.' + pat)) return true;
    } else if (entry.match_type === 'subject') {
      if (subj.includes(pat)) return true;
    }
  }
  return false;
}
