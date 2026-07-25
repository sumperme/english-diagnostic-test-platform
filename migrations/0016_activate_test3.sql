-- Activate Paper III (Speaking & Writing): selectable in the test picker
-- and startable via the attempts API.
UPDATE tests SET status = 'active' WHERE test_code = '03';
