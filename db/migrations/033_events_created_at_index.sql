-- Speed up GET /api/admin/events ORDER BY e.created_at DESC.
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
