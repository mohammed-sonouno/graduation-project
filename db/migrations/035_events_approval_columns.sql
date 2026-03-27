-- Add approval flags and timestamps for each step (used when admin auto-approves on create).
ALTER TABLE events ADD COLUMN IF NOT EXISTS supervisor_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dean_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS supervisor_approved_at TIMESTAMPTZ NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dean_approved_at TIMESTAMPTZ NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ NULL;
