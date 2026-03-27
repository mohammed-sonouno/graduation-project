-- Store which approval step requested changes (0=supervisor, 1=dean, 2=admin) so resubmission returns to that step.
ALTER TABLE events ADD COLUMN IF NOT EXISTS requested_changes_at_step INTEGER NULL;
COMMENT ON COLUMN events.requested_changes_at_step IS 'When status is changes_requested: step that requested changes. 0=supervisor, 1=dean, 2=admin. Used to return event to same approver on resubmit.';
