-- Persist the served (shuffled) question sequence per attempt, so quiz
-- numbering, web reports, and server-rendered PDFs can present questions in
-- the candidate's actual order. NULL for attempts created before this column
-- existed (those were served in canonical order).
ALTER TABLE test_attempt_answers ADD COLUMN display_order INTEGER;
