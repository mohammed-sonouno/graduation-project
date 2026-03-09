-- Strengthen analytics/event connections and add summary objects for dashboard queries.
ALTER TABLE event_reviews
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registration_id INTEGER REFERENCES event_registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_seeded BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN event_reviews.user_id IS 'Optional reviewer account when review is tied to a signed-in user.';
COMMENT ON COLUMN event_reviews.registration_id IS 'Optional event registration row this review came from; ensures analytics can trace back to participation.';
COMMENT ON COLUMN event_reviews.source IS 'How the review entered the system: manual, seed, import, or nlp.';
COMMENT ON COLUMN event_reviews.is_seeded IS 'True for demo/static reviews inserted to populate analytics.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_reviews_sentiment_check'
  ) THEN
    ALTER TABLE event_reviews
      ADD CONSTRAINT event_reviews_sentiment_check
      CHECK (sentiment IN ('positive', 'neutral', 'negative'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_reviews_override_sentiment_check'
  ) THEN
    ALTER TABLE event_reviews
      ADD CONSTRAINT event_reviews_override_sentiment_check
      CHECK (override_sentiment IS NULL OR override_sentiment IN ('positive', 'neutral', 'negative'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_reviews_source_check'
  ) THEN
    ALTER TABLE event_reviews
      ADD CONSTRAINT event_reviews_source_check
      CHECK (source IN ('manual', 'seed', 'import', 'nlp'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_reviews_user_id ON event_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_registration_id ON event_reviews(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_event_created_desc ON event_reviews(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_reviews_event_sentiment ON event_reviews(event_id, sentiment);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_reviews_registration_id
  ON event_reviews(registration_id)
  WHERE registration_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_reviews_event_user
  ON event_reviews(event_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_event_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_reviews_updated_at ON event_reviews;
CREATE TRIGGER trg_event_reviews_updated_at
BEFORE UPDATE ON event_reviews
FOR EACH ROW
EXECUTE PROCEDURE set_event_reviews_updated_at();

CREATE OR REPLACE FUNCTION validate_event_review_links()
RETURNS TRIGGER AS $$
DECLARE
  reg_event_id VARCHAR(100);
  reg_user_id INTEGER;
BEGIN
  IF NEW.registration_id IS NOT NULL THEN
    SELECT event_id, user_id
      INTO reg_event_id, reg_user_id
    FROM event_registrations
    WHERE id = NEW.registration_id;

    IF reg_event_id IS NULL THEN
      RAISE EXCEPTION 'registration_id % does not exist', NEW.registration_id;
    END IF;

    IF reg_event_id <> NEW.event_id THEN
      RAISE EXCEPTION 'registration % belongs to event %, not %', NEW.registration_id, reg_event_id, NEW.event_id;
    END IF;

    IF NEW.user_id IS NULL THEN
      NEW.user_id := reg_user_id;
    ELSIF reg_user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'registration % belongs to user %, not %', NEW.registration_id, reg_user_id, NEW.user_id;
    END IF;
  END IF;

  IF NEW.is_seeded THEN
    NEW.source := 'seed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_reviews_validate_links ON event_reviews;
CREATE TRIGGER trg_event_reviews_validate_links
BEFORE INSERT OR UPDATE ON event_reviews
FOR EACH ROW
EXECUTE PROCEDURE validate_event_review_links();

CREATE OR REPLACE VIEW event_analytics_summary AS
SELECT
  e.id,
  e.title,
  e.status,
  e.community_id,
  e.created_by,
  e.start_date,
  e.created_at,
  COUNT(DISTINCT er.id) AS registrations_count,
  COUNT(DISTINCT rv.id) AS reviews_count,
  ROUND(COALESCE(AVG(rv.rating::numeric), 0), 2) AS average_rating,
  COUNT(DISTINCT rv.id) FILTER (WHERE COALESCE(rv.override_sentiment, rv.sentiment) = 'positive') AS positive_reviews,
  COUNT(DISTINCT rv.id) FILTER (WHERE COALESCE(rv.override_sentiment, rv.sentiment) = 'neutral') AS neutral_reviews,
  COUNT(DISTINCT rv.id) FILTER (WHERE COALESCE(rv.override_sentiment, rv.sentiment) = 'negative') AS negative_reviews,
  COUNT(DISTINCT rv.id) FILTER (WHERE rv.user_id IS NOT NULL) AS identified_reviews,
  MAX(rv.created_at) AS latest_review_at
FROM events e
LEFT JOIN event_registrations er
  ON er.event_id = e.id
LEFT JOIN event_reviews rv
  ON rv.event_id = e.id
GROUP BY e.id, e.title, e.status, e.community_id, e.created_by, e.start_date, e.created_at;

COMMENT ON VIEW event_analytics_summary IS 'Per-event analytics summary joining events, registrations, and reviews for dashboard/reporting queries.';
