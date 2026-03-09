-- Allow role 'user' in app_users (API uses it for legacy/display; constraint in 020 did not include it).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_role_check') THEN
    ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
  END IF;
END $$;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('admin', 'student', 'dean', 'supervisor', 'community_leader', 'user'));
