-- Add NLP enrichment columns to event_reviews.
-- These are populated by the NLP service at review submission time
-- and read back by the analytics endpoint (no re-analysis at query time).

ALTER TABLE event_reviews
  ADD COLUMN IF NOT EXISTS nlp_confidence      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nlp_keywords        JSONB,
  ADD COLUMN IF NOT EXISTS nlp_issues          JSONB,
  ADD COLUMN IF NOT EXISTS nlp_aspects         JSONB,
  ADD COLUMN IF NOT EXISTS nlp_flag_for_review BOOLEAN DEFAULT FALSE;
