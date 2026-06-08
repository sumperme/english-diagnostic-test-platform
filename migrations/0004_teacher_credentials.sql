CREATE TABLE IF NOT EXISTS teacher_credentials (
  key TEXT PRIMARY KEY,
  user_group TEXT UNIQUE NOT NULL,
  remark TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_credentials_user_group ON teacher_credentials(user_group);
