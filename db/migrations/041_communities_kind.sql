-- Student communities (مجتمعات) vs formal associations/clubs (جمعيات) for events and organizers.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'community';

ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_kind_check;
ALTER TABLE communities ADD CONSTRAINT communities_kind_check CHECK (kind IN ('community', 'association'));

COMMENT ON COLUMN communities.kind IS 'community = student interest community; association = formal club/society (events organizer).';

-- Backfill: rows tied to supervisors/leaders or existing events behave as associations.
UPDATE communities SET kind = 'association'
WHERE EXISTS (
  SELECT 1 FROM app_users u
  WHERE u.community_id = communities.id AND u.role IN ('supervisor', 'community_leader')
)
OR EXISTS (
  SELECT 1 FROM events e WHERE e.community_id = communities.id
);
