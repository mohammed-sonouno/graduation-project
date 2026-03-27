-- Stronger constraints for core tables.
-- - app_users.role: restrict to known roles.
-- - events.status: restrict to known statuses.
-- - event_registrations.association_member: restrict to known values.
-- - login_codes.code: must be exactly 6 digits.

-- app_users.role allowed values
ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('admin', 'student', 'dean', 'supervisor', 'community_leader'));

-- events.status allowed workflow states
ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'needs_changes', 'upcoming', 'past'));

-- event_registrations.association_member allowed values
ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_association_member_check
  CHECK (association_member IN ('member', 'non-member'));

-- login_codes.code must be exactly 6 numeric digits
ALTER TABLE login_codes
  ADD CONSTRAINT login_codes_code_6_digits_check
  CHECK (code ~ '^[0-9]{6}$');

