-- Colleges and academic programs (for college profile pages and admin CRUD).
-- Run connected to database "Graduation Project".

-- Colleges: full profile for each college page
CREATE TABLE IF NOT EXISTS colleges (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  short_name    VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  tagline       VARCHAR(200),
  description   TEXT,
  badge_1_label VARCHAR(100),
  badge_1_icon  VARCHAR(20) DEFAULT 'check',
  badge_2_label VARCHAR(100),
  badge_2_icon  VARCHAR(20) DEFAULT 'users',
  stat_1        VARCHAR(100),
  stat_2        VARCHAR(100),
  stat_3        VARCHAR(100),
  stat_4        VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colleges_slug ON colleges (slug);

-- Academic programs (majors) under each college
CREATE TABLE IF NOT EXISTS academic_programs (
  id                SERIAL PRIMARY KEY,
  college_id        INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  credits           INTEGER,
  duration          VARCHAR(50),
  description       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  department        VARCHAR(200),
  required_gpa      VARCHAR(50),
  high_school_track VARCHAR(100),
  degree_type       VARCHAR(50),
  about_text        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (college_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_academic_programs_college ON academic_programs (college_id);

COMMENT ON TABLE colleges IS 'Colleges shown on /colleges and each college profile page.';
COMMENT ON TABLE academic_programs IS 'Academic programs (majors) under each college; shown on college profile and /majors/:id.';
