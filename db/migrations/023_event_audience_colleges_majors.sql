-- Event audience: who can join (all colleges vs specific colleges; all majors vs specific majors).
ALTER TABLE events ADD COLUMN IF NOT EXISTS for_all_colleges BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_college_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_all_majors BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_major_ids JSONB NOT NULL DEFAULT '[]';
COMMENT ON COLUMN events.for_all_colleges IS 'When true, event is open to all colleges. When false, only target_college_ids apply.';
COMMENT ON COLUMN events.target_college_ids IS 'Array of college IDs; used when for_all_colleges is false.';
COMMENT ON COLUMN events.target_all_majors IS 'When true (and for_all_colleges false), all majors in target colleges can join. When false, only target_major_ids.';
COMMENT ON COLUMN events.target_major_ids IS 'Array of major IDs; used when target_all_majors is false.';
