import type { D1Database } from '@cloudflare/workers-types';

// ---- Types ----

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
  attachments: string; // JSON
  received_at: string;
  is_read: number;
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
}

// ---- Inboxes ----

export async function getInbox(db: D1Database, address: string): Promise<Inbox | null> {
  return db.prepare('SELECT * FROM inboxes WHERE address = ?').bind(address).first<Inbox>();
}

export async function createInbox(db: D1Database, address: string, label = '', expiryHours = 0): Promise<void> {
  const expiresAt = expiryHours > 0
    ? new Date(Date.now() + expiryHours * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
    : null;
  await db
    .prepare('INSERT OR IGNORE INTO inboxes (address, label, expires_at) VALUES (?, ?, ?)')
    .bind(address, label, expiresAt)
    .run();
}

export async function inboxExists(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM inboxes WHERE address = ? LIMIT 1').bind(address).first();
  return !!row;
}

export async function getSessionInboxes(db: D1Database, sessionId: string): Promise<Inbox[]> {
  return db
    .prepare(
      `SELECT i.* FROM inboxes i
       INNER JOIN session_inboxes si ON si.inbox_address = i.address
       WHERE si.session_id = ?
       ORDER BY i.created_at DESC`
    )
    .bind(sessionId)
    .all<Inbox>()
    .then((r) => r.results);
}

export async function deleteInbox(db: D1Database, address: string): Promise<void> {
  await db.prepare('DELETE FROM inboxes WHERE address = ?').bind(address).run();
}

export async function touchInboxEmailTime(db: D1Database, address: string): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db.prepare('UPDATE inboxes SET last_email_at = ? WHERE address = ?').bind(now, address).run();
}

// ---- Messages ----

export async function getMessages(db: D1Database, inboxAddress: string, limit = 50): Promise<Message[]> {
  return db
    .prepare('SELECT * FROM messages WHERE inbox_address = ? ORDER BY received_at DESC LIMIT ?')
    .bind(inboxAddress, limit)
    .all<Message>()
    .then((r) => r.results);
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
  await db
    .prepare(
      `INSERT INTO messages (id, inbox_address, from_address, from_name, subject, body_text, body_html, otp_code, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      msg.id,
      msg.inbox_address,
      msg.from_address,
      msg.from_name,
      msg.subject,
      msg.body_text,
      msg.body_html,
      msg.otp_code,
      msg.attachments
    )
    .run();
}

export async function markMessageRead(db: D1Database, msgId: string): Promise<void> {
  await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(msgId).run();
}

export async function markForwarded(db: D1Database, msgId: string): Promise<void> {
  await db.prepare('UPDATE messages SET forwarded = 1 WHERE id = ?').bind(msgId).run();
}

// ---- Sessions ----

export async function ensureSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').bind(sessionId).run();
}

export async function sessionExists(db: D1Database, sessionId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM sessions WHERE id = ? LIMIT 1').bind(sessionId).first();
  return !!row;
}

// ---- Session-Inbox links ----

export async function linkInboxToSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO session_inboxes (session_id, inbox_address) VALUES (?, ?)')
    .bind(sessionId, address)
    .run();
}

export async function unlinkInboxFromSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare('DELETE FROM session_inboxes WHERE session_id = ? AND inbox_address = ?')
    .bind(sessionId, address)
    .run();
}

export async function isInboxInSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM session_inboxes WHERE session_id = ? AND inbox_address = ? LIMIT 1')
    .bind(sessionId, address)
    .first();
  return !!row;
}

// ---- Inbox Settings ----

export async function getInboxSettings(db: D1Database, address: string): Promise<InboxSettings | null> {
  return db
    .prepare('SELECT * FROM inbox_settings WHERE inbox_address = ?')
    .bind(address)
    .first<InboxSettings>();
}

export async function setInboxSettings(
  db: D1Database,
  address: string,
  settings: { webhook_url?: string | null; telegram_chat_id?: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO inbox_settings (inbox_address, webhook_url, telegram_chat_id)
       VALUES (?, ?, ?)
       ON CONFLICT(inbox_address) DO UPDATE SET
         webhook_url = COALESCE(excluded.webhook_url, inbox_settings.webhook_url),
         telegram_chat_id = COALESCE(excluded.telegram_chat_id, inbox_settings.telegram_chat_id)`
    )
    .bind(address, settings.webhook_url ?? null, settings.telegram_chat_id ?? null)
    .run();
}

// ---- Stats ----

export async function incrementStats(db: D1Database, type: 'emails' | 'inboxes'): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const col = type === 'emails' ? 'total_emails' : 'total_inboxes';
  await db
    .prepare(
      `INSERT INTO stats (date, total_emails, total_inboxes) VALUES (?, 0, 0)
       ON CONFLICT(date) DO UPDATE SET ${col} = ${col} + 1`
    )
    .bind(today)
    .run();
}

export async function getStatsRange(db: D1Database, days = 7): Promise<{ date: string; total_emails: number; total_inboxes: number }[]> {
  return db
    .prepare('SELECT * FROM stats ORDER BY date DESC LIMIT ?')
    .bind(days)
    .all<{ date: string; total_emails: number; total_inboxes: number }>()
    .then((r) => r.results);
}

export async function getTotalCounts(db: D1Database): Promise<{ inboxes: number; messages: number }> {
  const inboxes = await db.prepare('SELECT COUNT(*) as c FROM inboxes').first<{ c: number }>();
  const messages = await db.prepare('SELECT COUNT(*) as c FROM messages').first<{ c: number }>();
  return { inboxes: inboxes?.c ?? 0, messages: messages?.c ?? 0 };
}

// ---- Auto-expiry (called by cron) ----

export async function deleteExpiredInboxes(db: D1Database): Promise<number> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const result = await db.prepare('DELETE FROM inboxes WHERE expires_at IS NOT NULL AND expires_at < ?').bind(now).run();
  return result.meta?.changes ?? 0;
}

export async function pruneOldMessages(db: D1Database, maxPerInbox: number): Promise<number> {
  if (maxPerInbox <= 0) return 0;
  // Delete oldest messages exceeding max per inbox
  const result = await db
    .prepare(
      `DELETE FROM messages WHERE id NOT IN (
         SELECT id FROM messages m2
         WHERE m2.inbox_address = messages.inbox_address
         ORDER BY received_at DESC LIMIT ?
       )`
    )
    .bind(maxPerInbox)
    .run();
  return result.meta?.changes ?? 0;
}
