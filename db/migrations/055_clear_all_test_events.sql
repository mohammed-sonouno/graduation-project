-- Previously deleted all events (too broad). Kept as no-op so re-migrate does not wipe IEEE events.
-- To remove only legacy seed IDs, use 036_delete_seed_events.sql.
-- To restore IEEE events after an accidental full wipe: node server/scripts/restore-ieee-events.mjs
SELECT 1;
