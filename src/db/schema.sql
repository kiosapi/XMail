-- XMail D1 Schema v2
-- Run: wrangler d1 execute xmail-db --remote --file=src/db/schema.sql

-- ============================================================
-- Domains (configurable mail domains)
-- ============================================================
CREATE TABLE IF NOT EXISTS domains (
  domain      TEXT PRIMARY KEY,
  label       TEXT DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Inboxes
-- ============================================================
CREATE TABLE IF NOT EXISTS inboxes (
  address      TEXT PRIMARY KEY,
  label        TEXT DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT,
  last_email_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_inboxes_expires ON inboxes(expires_at);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  inbox_address TEXT NOT NULL,
  from_address  TEXT NOT NULL,
  from_name     TEXT DEFAULT '',
  subject       TEXT DEFAULT '(no subject)',
  body_text     TEXT DEFAULT '',
  body_html     TEXT DEFAULT '',
  otp_code      TEXT,
  attachments   TEXT DEFAULT '[]',
  received_at   TEXT NOT NULL DEFAULT (datetime('now')),
  is_read       INTEGER NOT NULL DEFAULT 0,
  is_starred    INTEGER NOT NULL DEFAULT 0,
  forwarded     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (inbox_address) REFERENCES inboxes(address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_inbox ON messages(inbox_address);
CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(inbox_address, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_otp ON messages(inbox_address, otp_code) WHERE otp_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(inbox_address, is_starred) WHERE is_starred = 1;

-- ============================================================
-- Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_inboxes (
  session_id     TEXT NOT NULL,
  inbox_address  TEXT NOT NULL,
  PRIMARY KEY (session_id, inbox_address),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (inbox_address) REFERENCES inboxes(address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_inboxes_session ON session_inboxes(session_id);

-- ============================================================
-- Stats (lightweight analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS stats (
  date        TEXT NOT NULL,
  total_emails    INTEGER NOT NULL DEFAULT 0,
  total_inboxes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date)
);

-- ============================================================
-- Settings (per-inbox config: webhook, telegram, forwarding)
-- ============================================================
CREATE TABLE IF NOT EXISTS inbox_settings (
  inbox_address TEXT NOT NULL,
  webhook_url   TEXT,
  telegram_chat_id TEXT,
  forward_to    TEXT,
  PRIMARY KEY (inbox_address),
  FOREIGN KEY (inbox_address) REFERENCES inboxes(address) ON DELETE CASCADE
);
