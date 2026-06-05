ALTER TABLE vouchers ADD COLUMN user_group TEXT NOT NULL DEFAULT 'General Learner';
ALTER TABLE vouchers ADD COLUMN education_level TEXT;
ALTER TABLE vouchers ADD COLUMN remark TEXT;
ALTER TABLE vouchers ADD COLUMN sold_to TEXT;

ALTER TABLE submissions ADD COLUMN user_group TEXT;

UPDATE vouchers SET user_group = 'General Learner' WHERE user_group IS NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_user_group ON vouchers(user_group);
CREATE INDEX IF NOT EXISTS idx_submissions_user_group ON submissions(user_group);
