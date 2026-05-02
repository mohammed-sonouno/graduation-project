-- Remove mock/seed communities safely.
--
-- The original seed community names (from 011_communities_and_role_assignments.sql) included:
-- Economics Forum, Business & Entrepreneurship Club, IEEE Student Branch,
-- Software Engineering Club, Law Society, Medical Students Society.
--
-- Requirement: delete only communities that are NOT used by any real user.
-- Safe baseline query (provided):
--   DELETE FROM communities
--   WHERE id NOT IN (
--     SELECT DISTINCT community_id FROM app_users WHERE community_id IS NOT NULL
--   );
--
-- Additional safety: also keep communities referenced by events to avoid orphaning events.

BEGIN;

DELETE FROM communities
WHERE id NOT IN (
  SELECT DISTINCT community_id FROM app_users WHERE community_id IS NOT NULL
)
AND id NOT IN (
  SELECT DISTINCT community_id FROM events WHERE community_id IS NOT NULL
);

COMMIT;

