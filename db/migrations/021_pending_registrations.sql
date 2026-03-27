-- Pending Google registrations: store in DB instead of browser sessionStorage.
-- After verify-google-new-code we create a row and return session_id; complete-registration consumes it.
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations(expires_at);

COMMENT ON TABLE pending_registrations IS 'Temporary store for new Google users after code verification; consumed by complete-registration.';
