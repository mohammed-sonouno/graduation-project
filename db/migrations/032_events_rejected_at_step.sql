-- Store which approval step rejected the event (0=supervisor, 1=dean, 2=admin) for correct stepper colors.
ALTER TABLE events ADD COLUMN IF NOT EXISTS rejected_at_step INTEGER NULL;
COMMENT ON COLUMN events.rejected_at_step IS 'When status is draft after reject: 0=supervisor, 1=dean, 2=admin. NULL otherwise.';
