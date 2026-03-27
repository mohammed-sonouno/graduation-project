-- Add student profile fields and must_change_password flag to app_users.
-- Run connected to database "Graduation Project".

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_name       VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS middle_name      VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_name        VARCHAR(100);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS student_number   VARCHAR(50) UNIQUE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS college          VARCHAR(200);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS major            VARCHAR(200);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone            VARCHAR(30);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_app_users_student_number ON app_users (student_number);
