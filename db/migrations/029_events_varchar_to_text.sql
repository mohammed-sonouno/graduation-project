-- Fix "value too long for type character varying(500)" on event create.
-- description, image, location: allow unlimited length (TEXT).
-- custom_sections: ensure JSONB (handles JSON.stringify output of any length).
ALTER TABLE events ALTER COLUMN description TYPE TEXT;
ALTER TABLE events ALTER COLUMN image TYPE TEXT;
ALTER TABLE events ALTER COLUMN location TYPE TEXT;
ALTER TABLE events ALTER COLUMN custom_sections TYPE JSONB USING custom_sections::jsonb;
