-- All events (replaces static events + managed events in localStorage).
CREATE TABLE IF NOT EXISTS events (
  id               VARCHAR(100) PRIMARY KEY,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  category         VARCHAR(100) DEFAULT 'Event',
  image            VARCHAR(500) DEFAULT '/event1.jpg',
  club_name        VARCHAR(255) DEFAULT 'University',
  location         VARCHAR(500),
  start_date       DATE,
  start_time       VARCHAR(50),
  end_date         DATE,
  end_time         VARCHAR(50),
  available_seats  INTEGER DEFAULT 0,
  price            NUMERIC(10,2) DEFAULT 0,
  price_member     NUMERIC(10,2),
  featured         BOOLEAN DEFAULT false,
  status           VARCHAR(50) NOT NULL DEFAULT 'draft',
  feedback         TEXT,
  approval_step    INTEGER DEFAULT 0,
  custom_sections  JSONB DEFAULT '[]',
  created_by       INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);

COMMENT ON TABLE events IS 'All events; status: draft, pending, approved, rejected, needs_changes, upcoming, past.';
