CREATE TABLE IF NOT EXISTS vouchers (
  code TEXT PRIMARY KEY,
  used_at INTEGER,
  used_by_session TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  voucher_code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (voucher_code) REFERENCES vouchers(code)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  session_token TEXT,
  payload TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_token) REFERENCES sessions(token)
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
