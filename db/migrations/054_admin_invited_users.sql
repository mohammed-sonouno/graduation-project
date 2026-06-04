-- Admin-invited external users (non-Najah email): login via code only, simplified profile with bio.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS invited_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN app_users.invited_by_admin IS 'True when an admin pre-created this account; allows non-Najah email login.';
COMMENT ON COLUMN student_profiles.bio IS 'Organization description for admin-invited external users.';
