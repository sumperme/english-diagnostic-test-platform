-- Paper I: Speaker B starts on a new line in dialogue stems.
-- Non-destructive. Do not edit 0020 (already applied).
--
-- The bank extractor collapsed wrapped Word paragraphs to a single line, so
-- "Speaker A: … Speaker B (reporting later): …" sat on one line. The quiz
-- card now keeps that newline (whitespace-pre-wrap).

UPDATE questions
SET prompt_text = REPLACE(prompt_text, ' Speaker B', CHAR(10) || 'Speaker B')
WHERE question_code LIKE '01-%'
  AND instr(prompt_text, 'Speaker A:') > 0
  AND instr(prompt_text, ' Speaker B') > 0;

-- Report PDFs are kept for 24 hours after the attempt ends (replaces FIFO-20).
ALTER TABLE pdf_cache_index ADD COLUMN expires_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_pdf_cache_expires ON pdf_cache_index(expires_at);
