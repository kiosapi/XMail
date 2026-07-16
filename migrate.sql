CREATE TABLE IF NOT EXISTS domains (
  domain      TEXT PRIMARY KEY,
  label       TEXT DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE messages ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inbox_settings ADD COLUMN forward_to TEXT;
