-- DB checkup: PII/sensitivity comments and indexes.
-- Run after 014. Do not expose PII tables to public or third-party APIs.

-- ========== PII / sensitive tables ==========
COMMENT ON TABLE app_users IS
  'PII: All accounts and personal data (email, name, password_hash, role, college_id, community_id).';

COMMENT ON TABLE student_profiles IS
  'PII: Per-user academic profile (college, major, gpa, picture).';

COMMENT ON TABLE event_registrations IS
  'PII: name, email, student_id per registration; use for app-only flows.';

COMMENT ON TABLE notifications IS
  'Per-user messages; may contain personal context.';

COMMENT ON TABLE app_module_data IS
  'Keyed JSON per module and optional user_id; restrict access by module_name and auth.';

-- ========== Reference data ==========
COMMENT ON TABLE colleges IS 'Reference: college names and ids.';
COMMENT ON TABLE majors IS 'Reference: major names and college_id.';
COMMENT ON TABLE communities IS 'Reference: community names and college_id.';
COMMENT ON TABLE events IS 'Event metadata; created_by is user-specific.';

-- ========== Indexes for common query patterns ==========
-- List "my registrations" ordered by created_at (already filtered by user_id)
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_created
  ON event_registrations (user_id, created_at DESC);

-- List notifications by user and read status (unread first)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC)
  WHERE read = false;
