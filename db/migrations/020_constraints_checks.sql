-- Stronger constraints for core tables (idempotent: skip if constraint already exists).
-- - app_users.role: restrict to known roles.
-- - events.status: restrict to known statuses.
-- - event_registrations.association_member: restrict to known values.
-- - login_codes.code: must be exactly 6 digits.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_role_check') THEN
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
    CHECK (role IN ('admin', 'student', 'dean', 'supervisor', 'community_leader'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_status_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'needs_changes', 'upcoming', 'past'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_association_member_check') THEN
    ALTER TABLE event_registrations ADD CONSTRAINT event_registrations_association_member_check
    CHECK (association_member IN ('member', 'non-member'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_codes_code_6_digits_check') THEN
    ALTER TABLE login_codes ADD CONSTRAINT login_codes_code_6_digits_check
    CHECK (code ~ '^[0-9]{6}$');
  END IF;
END $$;

