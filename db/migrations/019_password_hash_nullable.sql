-- Allow NULL password_hash for users who sign in only via email code or Google (no password set).
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;
