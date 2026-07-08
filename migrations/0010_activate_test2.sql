-- Activate Paper II (Listening & Reading): makes it selectable in the test
-- picker and startable via the attempts API.
UPDATE tests SET status = 'active' WHERE test_code = '02';
