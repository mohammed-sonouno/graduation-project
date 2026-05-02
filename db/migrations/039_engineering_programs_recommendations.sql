-- Engineering programs + recommendations data (Faculty of Engineering) - additive & safe.
-- Non-destructive: only CREATE TABLE IF NOT EXISTS + indexes.
-- Stores ONLY public program metadata and ESTIMATED acceptance thresholds (not official unless sourced).

BEGIN;

CREATE TABLE IF NOT EXISTS engineering_program_sources (
  id          SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url  TEXT NULL UNIQUE,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence  NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  notes       TEXT NULL
);

CREATE TABLE IF NOT EXISTS engineering_programs (
  id              SERIAL PRIMARY KEY,
  faculty_slug    VARCHAR(120) NOT NULL DEFAULT 'an-najah-faculty-engineering',
  program_key     VARCHAR(80) NOT NULL UNIQUE, -- stable key for upserts
  name_en         TEXT NOT NULL,
  name_ar         TEXT NULL,
  description_en  TEXT NULL,
  description_ar  TEXT NULL,
  degree_type     VARCHAR(30) NOT NULL DEFAULT 'Bachelor',
  stream_type     VARCHAR(20) NOT NULL CHECK (stream_type IN ('scientific','industrial','both')),

  -- Acceptance thresholds:
  -- If not officially confirmed, store as estimate range and mark is_estimate=true.
  min_acceptance_average_min NUMERIC(5,2) NULL,
  min_acceptance_average_max NUMERIC(5,2) NULL,
  is_estimate     BOOLEAN NOT NULL DEFAULT TRUE,

  difficulty_level VARCHAR(10) NULL CHECK (difficulty_level IN ('low','medium','high')),
  estimated_competition_level VARCHAR(10) NULL CHECK (estimated_competition_level IN ('low','medium','high')),
  general_notes   TEXT NULL,
  keywords        TEXT[] NOT NULL DEFAULT '{}',
  source_id       INTEGER NULL REFERENCES engineering_program_sources(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engineering_programs_faculty ON engineering_programs(faculty_slug);
CREATE INDEX IF NOT EXISTS idx_engineering_programs_stream ON engineering_programs(stream_type);
CREATE INDEX IF NOT EXISTS idx_engineering_programs_keywords_gin ON engineering_programs USING GIN (keywords);

COMMIT;

