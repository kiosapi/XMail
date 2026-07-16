CREATE TABLE IF NOT EXISTS blocklist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT NOT NULL,
  match_type  TEXT NOT NULL DEFAULT 'sender',
  scope       TEXT NOT NULL DEFAULT 'global',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blocklist_scope ON blocklist(scope);
CREATE INDEX IF NOT EXISTS idx_blocklist_pattern ON blocklist(pattern);
