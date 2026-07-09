-- AI feedback (DeepSeek) support.
--
-- attempt_reports gains a per-attempt AI feedback job state machine:
--   ai_status: none | pending | done | failed
--   Bilingual feedback is stored as layout-free text (EN + zh-HK) so the web
--   report and the server-rendered PDF both render the active language.
-- teacher_credentials gains a class-overview quota (default 20, admin-adjustable).
-- class_overviews stores the teacher-facing history of generated overviews.
-- submissions.attempt_id links legacy Test 1 rows to their dual-written attempt
-- so the teacher dashboard can join AI feedback onto the submission list.

ALTER TABLE attempt_reports ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE attempt_reports ADD COLUMN ai_feedback_en TEXT;
ALTER TABLE attempt_reports ADD COLUMN ai_feedback_zh TEXT;
ALTER TABLE attempt_reports ADD COLUMN ai_generated_at INTEGER;
ALTER TABLE attempt_reports ADD COLUMN ai_claimed_at INTEGER;
ALTER TABLE attempt_reports ADD COLUMN ai_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE teacher_credentials ADD COLUMN ai_uses_allowed INTEGER NOT NULL DEFAULT 20;
ALTER TABLE teacher_credentials ADD COLUMN ai_use_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE submissions ADD COLUMN attempt_id TEXT;

CREATE TABLE IF NOT EXISTS class_overviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_key TEXT NOT NULL REFERENCES teacher_credentials(key),
  user_group TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_zh TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_class_overviews_teacher ON class_overviews(teacher_key, created_at);
