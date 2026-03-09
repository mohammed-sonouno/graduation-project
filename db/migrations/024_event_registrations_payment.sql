-- Payment step for event registrations: student requests → pending payment → paid → community approves (until event full).
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
COMMENT ON COLUMN event_registrations.paid_at IS 'When the student paid; used to order "first paid, first approved" up to event capacity.';
