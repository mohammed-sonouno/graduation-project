-- Each event must be connected to a community (and thus to the college of that community).
ALTER TABLE events ADD COLUMN IF NOT EXISTS community_id INTEGER NULL REFERENCES communities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);
COMMENT ON COLUMN events.community_id IS 'Community that hosts this event; community belongs to one college.';
