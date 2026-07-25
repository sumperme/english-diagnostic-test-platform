-- Paper III constructed-response support: speaking/writing response types,
-- audio + transcript + AI mark columns on answers, grading_status on attempts.
-- Additive only; MCQ columns remain for Tests 1–2.

ALTER TABLE question_groups ADD COLUMN response_type TEXT NOT NULL DEFAULT 'mcq';

-- SQLite cannot drop NOT NULL; recreate is avoided — new speaking/writing rows
-- store empty-string placeholders for unused MCQ option columns where needed.
-- Prefer nullable for clarity on fresh DBs that apply this migration after 0006.
-- D1/SQLite: ALTER COLUMN is limited; keep options as-is and seed empty strings
-- for non-MCQ questions (see seed generator).

ALTER TABLE test_attempt_answers ADD COLUMN text_response TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN audio_r2_key TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN audio_content_type TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN audio_bytes INTEGER;
ALTER TABLE test_attempt_answers ADD COLUMN assemblyai_transcript_id TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN transcript_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE test_attempt_answers ADD COLUMN transcript_text TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN transcript_words_json TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN ai_mark_json TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN ai_band_key TEXT;
ALTER TABLE test_attempt_answers ADD COLUMN recording_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE test_attempts ADD COLUMN grading_status TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_attempt_answers_transcript_id
  ON test_attempt_answers(assemblyai_transcript_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_grading
  ON test_attempts(grading_status);
