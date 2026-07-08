-- Per-test voucher usage: vouchers.uses_allowed now means allowed attempts PER TEST
-- (one voucher covers Test 1 and Test 2, each up to N submissions).
-- vouchers.use_count remains the total across tests for admin display.

CREATE TABLE IF NOT EXISTS voucher_test_usage (
  voucher_code TEXT NOT NULL REFERENCES vouchers(code),
  test_id INTEGER NOT NULL REFERENCES tests(id),
  use_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (voucher_code, test_id)
);

-- Preserve history: all existing usage was Test 1.
INSERT OR IGNORE INTO voucher_test_usage (voucher_code, test_id, use_count)
SELECT code, 1, use_count FROM vouchers WHERE use_count > 0;
