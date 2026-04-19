-- University knowledge module (An-Najah National University) - additive & safe.
-- Non-destructive: only CREATE TABLE IF NOT EXISTS + indexes.
-- Designed for chatbot retrieval; no user data involved.
-- Wrap in a transaction for safety.

BEGIN;

CREATE TABLE IF NOT EXISTS university_sources (
  id          SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL UNIQUE,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence  NUMERIC(3,2) NOT NULL DEFAULT 0.80,
  notes       TEXT NULL
);

CREATE TABLE IF NOT EXISTS university_profiles (
  id                    SERIAL PRIMARY KEY,
  slug                  VARCHAR(80) NOT NULL UNIQUE,
  official_name         TEXT NOT NULL,
  short_name            TEXT NULL,
  aliases               TEXT[] NOT NULL DEFAULT '{}',
  city                  TEXT NULL,
  country               TEXT NULL,
  institution_type      TEXT NULL,
  overview              TEXT NULL,
  founded_year_school   INTEGER NULL,
  became_university_year INTEGER NULL,
  mission_text          TEXT NULL,
  mission_summary       TEXT NULL,
  campuses_count        INTEGER NULL,
  campuses_note         TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_university_profiles_slug ON university_profiles(slug);

CREATE TABLE IF NOT EXISTS university_statistics (
  id                 SERIAL PRIMARY KEY,
  university_id      INTEGER NOT NULL REFERENCES university_profiles(id) ON DELETE CASCADE,
  as_of_label        TEXT NOT NULL, -- e.g. '2022/2023' (as stated by source)
  faculties_count    INTEGER NULL,
  bachelor_programs_count INTEGER NULL,
  master_programs_count   INTEGER NULL,
  phd_programs_count      INTEGER NULL,
  programs_total     INTEGER NULL,
  students_count     INTEGER NULL,
  campuses_count     INTEGER NULL,
  scholarships_count INTEGER NULL,
  research_papers_count INTEGER NULL,
  source_id          INTEGER NULL REFERENCES university_sources(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, as_of_label)
);

CREATE INDEX IF NOT EXISTS idx_university_statistics_university ON university_statistics(university_id, as_of_label);

CREATE TABLE IF NOT EXISTS university_timeline (
  id            SERIAL PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES university_profiles(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NULL,
  source_id     INTEGER NULL REFERENCES university_sources(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (university_id, year, title)
);

CREATE INDEX IF NOT EXISTS idx_university_timeline_university_year ON university_timeline(university_id, year);

CREATE TABLE IF NOT EXISTS university_topics (
  id            SERIAL PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES university_profiles(id) ON DELETE CASCADE,
  topic_key     VARCHAR(80) NOT NULL,
  title_en      TEXT NULL,
  title_ar      TEXT NULL,
  summary_en    TEXT NULL,
  summary_ar    TEXT NULL,
  UNIQUE (university_id, topic_key)
);

CREATE INDEX IF NOT EXISTS idx_university_topics_key ON university_topics(university_id, topic_key);

CREATE TABLE IF NOT EXISTS university_tags (
  id        SERIAL PRIMARY KEY,
  tag_text  TEXT NOT NULL,
  lang      VARCHAR(10) NOT NULL DEFAULT 'und', -- 'en', 'ar', 'und'
  UNIQUE (tag_text, lang)
);

CREATE TABLE IF NOT EXISTS university_topic_tags (
  topic_id  INTEGER NOT NULL REFERENCES university_topics(id) ON DELETE CASCADE,
  tag_id    INTEGER NOT NULL REFERENCES university_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, tag_id)
);

CREATE TABLE IF NOT EXISTS university_qa (
  id               SERIAL PRIMARY KEY,
  university_id    INTEGER NOT NULL REFERENCES university_profiles(id) ON DELETE CASCADE,
  topic_id         INTEGER NULL REFERENCES university_topics(id) ON DELETE SET NULL,
  question_en      TEXT NULL,
  question_ar      TEXT NULL,
  answer_en        TEXT NULL,
  answer_ar        TEXT NULL,
  normalized_intent TEXT NULL,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  source_id        INTEGER NULL REFERENCES university_sources(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_university_qa_university ON university_qa(university_id);
CREATE INDEX IF NOT EXISTS idx_university_qa_intent ON university_qa(university_id, normalized_intent);
CREATE INDEX IF NOT EXISTS idx_university_qa_keywords_gin ON university_qa USING GIN (keywords);

COMMIT;

