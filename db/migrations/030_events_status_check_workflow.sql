-- Update events.status check to allow new approval workflow statuses.
-- Drop existing constraint (name may exist from 020_constraints_checks.sql).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN (
    'draft',
    'pending_supervisor',
    'pending_dean',
    'pending_admin',
    'approved',
    'changes_requested',
    'rejected',
    'pending',
    'needs_changes',
    'upcoming',
    'past'
  ));
