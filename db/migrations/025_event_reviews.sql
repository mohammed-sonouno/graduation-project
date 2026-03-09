-- Event reviews for analytics: rating, comment, sentiment (with optional admin override).
-- id default requires PostgreSQL 13+ (gen_random_uuid) or pgcrypto extension on older PG.
CREATE TABLE IF NOT EXISTS event_reviews (
  id                VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id           VARCHAR(100) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating             INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment            TEXT,
  sentiment          VARCHAR(20) NOT NULL DEFAULT 'neutral',
  override_sentiment  VARCHAR(20),
  sentiment_score    DOUBLE PRECISION DEFAULT 0,
  sentiment_raw      JSONB,
  language           VARCHAR(20) DEFAULT 'unknown',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_event_id ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_sentiment ON event_reviews(sentiment);
CREATE INDEX IF NOT EXISTS idx_event_reviews_override_sentiment ON event_reviews(override_sentiment);
CREATE INDEX IF NOT EXISTS idx_event_reviews_created_at ON event_reviews(created_at);

COMMENT ON TABLE event_reviews IS 'Reviews per event for analytics; sentiment: positive|neutral|negative; override_sentiment is admin override.';
