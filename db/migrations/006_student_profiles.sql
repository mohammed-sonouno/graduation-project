-- Student profile (one per user; extends app_users for students).
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id         INTEGER PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  college         VARCHAR(255),
  major           VARCHAR(255),
  gpa             NUMERIC(4,2),
  credits_earned   INTEGER,
  credits_total   INTEGER,
  picture         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
