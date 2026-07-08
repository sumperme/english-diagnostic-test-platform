-- Unified multi-test question bank, randomization engine, attempt tracking,
-- feedback variables, score conversion grids, and PDF cache index.
-- Additive only: legacy tables (vouchers, sessions, submissions,
-- teacher_credentials) are unchanged. See DATABASE_README.md.

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  time_limit_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id),
  part_code TEXT NOT NULL,
  name TEXT NOT NULL,
  skill TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(test_id, part_code)
);

CREATE TABLE IF NOT EXISTS dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_part_id INTEGER NOT NULL REFERENCES test_parts(id),
  dimension_code TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  short TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(test_part_id, dimension_code)
);

CREATE TABLE IF NOT EXISTS shared_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER REFERENCES tests(id),
  resource_type TEXT NOT NULL,
  title TEXT,
  content_url TEXT,
  text_content TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS question_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id),
  test_part_id INTEGER NOT NULL REFERENCES test_parts(id),
  dimension_id INTEGER REFERENCES dimensions(id),
  shared_resource_id INTEGER REFERENCES shared_resources(id),
  group_code TEXT NOT NULL,
  canonical_number INTEGER NOT NULL,
  legacy_qid TEXT,
  variant_count INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(test_id, group_code)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_group_id INTEGER NOT NULL REFERENCES question_groups(id),
  question_code TEXT UNIQUE NOT NULL,
  variant_code TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(question_group_id, variant_code)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_ref TEXT UNIQUE,
  display_name TEXT,
  email TEXT,
  user_group TEXT,
  education_level TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  test_id INTEGER NOT NULL REFERENCES tests(id),
  session_token TEXT,
  start_time INTEGER,
  end_time INTEGER,
  status TEXT NOT NULL DEFAULT 'in-progress',
  overall_score INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_attempt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_attempt_id TEXT NOT NULL REFERENCES test_attempts(id),
  question_group_id INTEGER NOT NULL REFERENCES question_groups(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  question_code TEXT NOT NULL,
  selected_option TEXT,
  is_correct INTEGER,
  answered_at INTEGER,
  UNIQUE(test_attempt_id, question_group_id)
);

CREATE TABLE IF NOT EXISTS attempt_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_attempt_id TEXT UNIQUE NOT NULL REFERENCES test_attempts(id),
  report_version TEXT NOT NULL,
  variables TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS score_conversion_bands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id),
  test_part_id INTEGER REFERENCES test_parts(id),
  min_correct INTEGER NOT NULL,
  max_correct INTEGER NOT NULL,
  band_key TEXT NOT NULL,
  cefr_label TEXT NOT NULL,
  ielts_indicative TEXT,
  toefl_indicative TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pdf_cache_index (
  cache_key TEXT PRIMARY KEY,
  test_attempt_id TEXT NOT NULL REFERENCES test_attempts(id),
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_groups_test ON question_groups(test_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_part ON question_groups(test_part_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_dimension ON question_groups(dimension_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_resource ON question_groups(shared_resource_id);
CREATE INDEX IF NOT EXISTS idx_questions_group ON questions(question_group_id);
CREATE INDEX IF NOT EXISTS idx_shared_resources_test ON shared_resources(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON test_attempt_answers(test_attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON test_attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_code ON test_attempt_answers(question_code);
CREATE INDEX IF NOT EXISTS idx_conversion_bands_test_part ON score_conversion_bands(test_id, test_part_id);
CREATE INDEX IF NOT EXISTS idx_pdf_cache_created ON pdf_cache_index(created_at);
