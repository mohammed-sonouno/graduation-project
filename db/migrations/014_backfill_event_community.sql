-- Backfill events that have no community: assign first community so every event is linked to a community (and its college).
UPDATE events
SET community_id = (SELECT id FROM communities ORDER BY id LIMIT 1)
WHERE community_id IS NULL
  AND EXISTS (SELECT 1 FROM communities LIMIT 1);
