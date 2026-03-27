-- Allow both association leader and supervisor to be linked to the same community (e.g. IEEE).
-- Drops the one-user-per-community unique constraint so leader and supervisor can share community_id.
DROP INDEX IF EXISTS idx_app_users_community_unique;
