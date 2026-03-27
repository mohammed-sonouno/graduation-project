-- Ensure events table has ALL columns required by POST /api/events INSERT (26 columns).
-- Fixes 42601 "INSERT has more expressions than target columns" when DB is missing columns.
-- Base table (004) has: id, title, description, category, image, club_name, location,
-- start_date, start_time, end_date, end_time, available_seats, price, price_member,
-- featured, status, feedback, approval_step, custom_sections, created_by, created_at, updated_at.
-- 013 adds community_id; 023 adds for_all_colleges, target_college_ids, target_all_majors, target_major_ids.
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS community_id INTEGER NULL REFERENCES communities(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS for_all_colleges BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_college_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_all_majors BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_major_ids JSONB NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);
