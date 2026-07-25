-- Per-paper Class AI Overviews: store which paper (01/02/03) an overview
-- was generated for. Existing rows default to Paper I ('01'). Shared teacher
-- AI quota (ai_use_count / ai_uses_allowed) is unchanged — one pool across papers.

ALTER TABLE class_overviews ADD COLUMN test_code TEXT NOT NULL DEFAULT '01';

CREATE INDEX IF NOT EXISTS idx_class_overviews_teacher_test
  ON class_overviews(teacher_key, test_code, created_at);
