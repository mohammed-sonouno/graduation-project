-- Add status/decision metadata to event_registrations so community leaders/supervisors can approve/reject.
ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);

