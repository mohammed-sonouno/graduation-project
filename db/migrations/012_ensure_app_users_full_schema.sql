-- Ensure app_users has all columns required by the app (login, register, Google, complete-profile).
-- All account data is stored and read from this table (DB is source of truth).

-- Core (002)
-- id, email, password_hash, role, created_at already exist

-- Student/profile fields (003)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_name       VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS middle_name      VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_name        VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS student_number   VARCHAR(50);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS college          VARCHAR(200);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS major            VARCHAR(200);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone            VARCHAR(30);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- First-time flow: must complete profile (005)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_complete_profile BOOLEAN NOT NULL DEFAULT FALSE;

-- Role assignments (011): college_id for dean, community_id for supervisor
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS college_id INTEGER NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS community_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_student_number ON app_users (student_number) WHERE student_number IS NOT NULL;

COMMENT ON TABLE app_users IS 'All registered accounts (email/password and Google). Roles: admin, student, dean, supervisor, community_leader. Profile: first_name, middle_name, last_name, student_number, college, major, phone.';
