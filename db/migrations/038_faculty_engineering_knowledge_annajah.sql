-- Faculty knowledge module: Faculty of Engineering (An-Najah National University) - additive & safe.
-- Non-destructive: only CREATE TABLE IF NOT EXISTS + indexes.
-- No user data. Designed for chatbot retrieval.

BEGIN;

CREATE TABLE IF NOT EXISTS faculty_sources (
  id          SERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL UNIQUE,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence  NUMERIC(3,2) NOT NULL DEFAULT 0.80,
  notes       TEXT NULL
);

CREATE TABLE IF NOT EXISTS faculty_profiles (
  id               SERIAL PRIMARY KEY,
  university_slug  VARCHAR(80) NOT NULL DEFAULT 'an-najah',
  slug             VARCHAR(120) NOT NULL UNIQUE, -- e.g. 'an-najah-engineering'
  official_name_en TEXT NOT NULL,
  official_name_ar TEXT NULL,
  aliases          TEXT[] NOT NULL DEFAULT '{}',
  overview_en      TEXT NULL,
  overview_ar      TEXT NULL,
  location_en      TEXT NULL,
  location_ar      TEXT NULL,
  role_en          TEXT NULL,
  role_ar          TEXT NULL,
  mission_summary_en TEXT NULL,
  mission_summary_ar TEXT NULL,
  vision_summary_en  TEXT NULL,
  vision_summary_ar  TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_profiles_slug ON faculty_profiles(slug);

CREATE TABLE IF NOT EXISTS faculty_statistics (
  id                   SERIAL PRIMARY KEY,
  faculty_id            INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  as_of_label           TEXT NOT NULL, -- e.g. '2026-02' or 'public page (no date)'
  departments_count     INTEGER NULL,
  programs_count        INTEGER NULL,
  students_count        INTEGER NULL,
  faculty_members_count INTEGER NULL,
  labs_count            INTEGER NULL,
  facilities_note_en    TEXT NULL,
  facilities_note_ar    TEXT NULL,
  source_id             INTEGER NULL REFERENCES faculty_sources(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, as_of_label)
);

CREATE INDEX IF NOT EXISTS idx_faculty_statistics_faculty ON faculty_statistics(faculty_id, as_of_label);

CREATE TABLE IF NOT EXISTS faculty_departments (
  id            SERIAL PRIMARY KEY,
  faculty_id    INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  name_en       TEXT NOT NULL,
  name_ar       TEXT NULL,
  description_en TEXT NULL,
  description_ar TEXT NULL,
  degree_levels TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'BSc','MSc'}
  source_id     INTEGER NULL REFERENCES faculty_sources(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (faculty_id, name_en)
);

CREATE INDEX IF NOT EXISTS idx_faculty_departments_faculty ON faculty_departments(faculty_id, sort_order);

CREATE TABLE IF NOT EXISTS faculty_facilities (
  id            SERIAL PRIMARY KEY,
  faculty_id    INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  facility_type VARCHAR(60) NOT NULL DEFAULT 'facility', -- 'lab', 'workshop', 'center', etc.
  name_en       TEXT NOT NULL,
  name_ar       TEXT NULL,
  description_en TEXT NULL,
  description_ar TEXT NULL,
  source_id     INTEGER NULL REFERENCES faculty_sources(id) ON DELETE SET NULL,
  UNIQUE (faculty_id, facility_type, name_en)
);

CREATE INDEX IF NOT EXISTS idx_faculty_facilities_faculty ON faculty_facilities(faculty_id, facility_type);

CREATE TABLE IF NOT EXISTS faculty_timeline (
  id            SERIAL PRIMARY KEY,
  faculty_id    INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  year          INTEGER NULL,
  title_en      TEXT NOT NULL,
  title_ar      TEXT NULL,
  description_en TEXT NULL,
  description_ar TEXT NULL,
  source_id     INTEGER NULL REFERENCES faculty_sources(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (faculty_id, title_en)
);

CREATE INDEX IF NOT EXISTS idx_faculty_timeline_faculty ON faculty_timeline(faculty_id, sort_order);

CREATE TABLE IF NOT EXISTS faculty_topics (
  id           SERIAL PRIMARY KEY,
  faculty_id   INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  topic_key    VARCHAR(80) NOT NULL,
  title_en     TEXT NULL,
  title_ar     TEXT NULL,
  summary_en   TEXT NULL,
  summary_ar   TEXT NULL,
  UNIQUE (faculty_id, topic_key)
);

CREATE INDEX IF NOT EXISTS idx_faculty_topics_key ON faculty_topics(faculty_id, topic_key);

CREATE TABLE IF NOT EXISTS faculty_tags (
  id        SERIAL PRIMARY KEY,
  tag_text  TEXT NOT NULL,
  lang      VARCHAR(10) NOT NULL DEFAULT 'und',
  UNIQUE (tag_text, lang)
);

CREATE TABLE IF NOT EXISTS faculty_topic_tags (
  topic_id  INTEGER NOT NULL REFERENCES faculty_topics(id) ON DELETE CASCADE,
  tag_id    INTEGER NOT NULL REFERENCES faculty_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, tag_id)
);

CREATE TABLE IF NOT EXISTS faculty_qa (
  id               SERIAL PRIMARY KEY,
  faculty_id       INTEGER NOT NULL REFERENCES faculty_profiles(id) ON DELETE CASCADE,
  topic_id         INTEGER NULL REFERENCES faculty_topics(id) ON DELETE SET NULL,
  question_en      TEXT NULL,
  question_ar      TEXT NULL,
  answer_en        TEXT NULL,
  answer_ar        TEXT NULL,
  normalized_intent TEXT NULL,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  source_id        INTEGER NULL REFERENCES faculty_sources(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_qa_faculty ON faculty_qa(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_qa_intent ON faculty_qa(faculty_id, normalized_intent);
CREATE INDEX IF NOT EXISTS idx_faculty_qa_keywords_gin ON faculty_qa USING GIN (keywords);

COMMIT;

