-- Require first-time Google sign-in students to complete university info.
-- Run connected to database "Graduation Project".

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_complete_profile BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN app_users.must_complete_profile IS 'When true, student must submit the university info form (e.g. after first Google sign-in).';
