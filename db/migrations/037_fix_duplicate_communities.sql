-- Fix duplicate community rows (e.g., "IEEE") by:
-- 1) picking the canonical (lowest) id per name (specifically IEEE),
-- 2) rewiring foreign keys (app_users.community_id, events.community_id),
-- 3) deleting duplicate rows,
-- 4) adding a unique constraint on communities.name to prevent reoccurrence.
--
-- NOTE: The migration runner uses a hardcoded list (server/run-migrations.js).
-- This file must be added to that list to run.

DO $$
DECLARE
  canonical_id BIGINT;
  dup_ids BIGINT[];
  duplicate_names TEXT[];
BEGIN
  -- ---------- Phase 1: fix IEEE duplicates (if they exist) ----------
  SELECT MIN(id) INTO canonical_id
  FROM communities
  WHERE name = 'IEEE';

  -- If IEEE doesn't exist, nothing to rewire; continue to constraint safety checks.
  IF canonical_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id ORDER BY id) INTO dup_ids
    FROM communities
    WHERE name = 'IEEE' AND id <> canonical_id;

    IF dup_ids IS NOT NULL AND array_length(dup_ids, 1) > 0 THEN
      -- Update foreign-key-like references to point to canonical IEEE id.
      UPDATE app_users
      SET community_id = canonical_id
      WHERE community_id = ANY(dup_ids);

      UPDATE events
      SET community_id = canonical_id
      WHERE community_id = ANY(dup_ids);

      -- Delete the duplicate communities rows.
      DELETE FROM communities
      WHERE id = ANY(dup_ids);
    END IF;
  END IF;

  -- ---------- Phase 2: prevent duplicates going forward ----------
  -- Before adding UNIQUE(name), ensure there are no duplicate names remaining.
  SELECT ARRAY_AGG(name ORDER BY name) INTO duplicate_names
  FROM (
    SELECT name
    FROM communities
    GROUP BY name
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_names IS NOT NULL AND array_length(duplicate_names, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot add UNIQUE(communities.name). Duplicate names still exist: %', duplicate_names;
  END IF;

  -- Add constraint only if it doesn't already exist.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'communities_name_unique'
  ) THEN
    ALTER TABLE communities
      ADD CONSTRAINT communities_name_unique UNIQUE (name);
  END IF;
END $$;

