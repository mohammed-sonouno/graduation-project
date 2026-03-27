-- Communities belong to a college. One supervisor per community; one community per supervisor.
-- One dean per college; dean has access only to communities in their college.

-- Communities (each belongs to one college)
CREATE TABLE IF NOT EXISTS communities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  UNIQUE (name, college_id)
);

CREATE INDEX IF NOT EXISTS idx_communities_college ON communities(college_id);
COMMENT ON TABLE communities IS 'Communities within a college; each community can have one supervisor.';

-- Link deans to a college (one dean per college)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS college_id INTEGER NULL REFERENCES colleges(id) ON DELETE SET NULL;
-- Link supervisors to a community (one supervisor per community)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS community_id INTEGER NULL REFERENCES communities(id) ON DELETE SET NULL;

-- One supervisor per community: no two users can have the same community_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_community_unique ON app_users(community_id) WHERE community_id IS NOT NULL;

-- One dean per college: no two deans can have the same college_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_dean_college_unique ON app_users(college_id) WHERE role = 'dean';

-- Seed communities (one or two per college)
INSERT INTO communities (name, college_id) VALUES
  ('IEEE Student Branch', 1),
  ('Software Engineering Club', 1),
  ('Medical Students Society', 2),
  ('Economics Forum', 3),
  ('Business & Entrepreneurship Club', 4),
  ('Law Society', 5)
ON CONFLICT (name, college_id) DO NOTHING;
