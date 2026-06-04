-- Fix incorrect kind values set by migration 041 backfill.
-- The backfill wrongly set communities to 'association' if they had supervisors or events.
-- Correct rule: only communities created via the legacy admin flow (college_id IS NOT NULL)
-- or explicitly named 'ieee' are true associations. Everything else is 'community'.
UPDATE communities
SET kind = 'community'
WHERE kind = 'association'
  AND lower(trim(name)) != 'ieee'
  AND college_id IS NULL;
