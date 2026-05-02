-- Assign ieee@najah.edu (id=4) and ieee.sup@najah.edu (id=5) to the IEEE community
-- if they currently have community_id = NULL.
--
-- Note: communities.name is UNIQUE (see 037_fix_duplicate_communities.sql), so SELECT ... LIMIT 1 is stable.

UPDATE app_users
SET community_id = (SELECT id FROM communities WHERE name = 'IEEE' LIMIT 1)
WHERE id IN (4, 5) AND community_id IS NULL;

