-- Incremental DeepSeek API usage logging for admin spending visibility.
-- Append-only: one row per successful API call that returns token usage.

CREATE TABLE IF NOT EXISTS ai_api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  feature_type TEXT NOT NULL,
  voucher_code TEXT,
  teacher_key TEXT,
  test_code TEXT,
  attempt_id TEXT,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_api_usage_logs(created_at DESC);
