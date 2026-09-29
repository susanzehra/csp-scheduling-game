CREATE TABLE IF NOT EXISTS visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS completions (
  completion_id TEXT PRIMARY KEY,
  encrypted_record TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_completions_received_at
ON completions(received_at);
