-- Remove seed events inserted by 008_seed_events.sql so Manage Events shows only events created through the app.
-- These IDs are the ones from the original seed (upcoming/past demo events).
DELETE FROM event_registrations WHERE event_id IN (
  'symp-2024', 'future-projects', 'leadership-retreat',
  'bio-genomics', 'digital-transformation', 'careers-networking'
);
DELETE FROM events WHERE id IN (
  'symp-2024', 'future-projects', 'leadership-retreat',
  'bio-genomics', 'digital-transformation', 'careers-networking'
);
