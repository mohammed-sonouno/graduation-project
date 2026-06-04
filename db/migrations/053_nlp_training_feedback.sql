-- Migration 053: NLP Training Feedback Loop
-- Adds columns to track admin corrections used for model improvement,
-- and a table to store the history of training runs.

-- ── event_reviews additions ────────────────────────────────────────────────
ALTER TABLE event_reviews
  ADD COLUMN IF NOT EXISTS used_for_training    BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS training_corrected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_reviews_used_for_training
  ON event_reviews (used_for_training);

-- ── training runs history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nlp_training_runs (
  id                    SERIAL PRIMARY KEY,
  triggered_by          INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  samples_used          INTEGER,
  accuracy_before       DOUBLE PRECISION,
  accuracy_after        DOUBLE PRECISION,
  model_version_before  VARCHAR(200),
  model_version_after   VARCHAR(200),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_nlp_training_runs_started_at
  ON nlp_training_runs (started_at DESC);
