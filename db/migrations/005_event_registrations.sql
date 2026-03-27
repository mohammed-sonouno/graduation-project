-- Event registrations (user signs up for an event).
CREATE TABLE IF NOT EXISTS event_registrations (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_id          VARCHAR(100) NOT NULL,
  student_id        VARCHAR(50),
  college           VARCHAR(255),
  major             VARCHAR(255),
  association_member VARCHAR(50) DEFAULT 'non-member',
  name              VARCHAR(255),
  email             VARCHAR(255),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);

-- FK to events (optional; ensures referential integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_event_id_fkey'
  ) THEN
    ALTER TABLE event_registrations
      ADD CONSTRAINT event_registrations_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;
