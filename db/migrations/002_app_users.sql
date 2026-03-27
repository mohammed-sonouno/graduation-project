-- App users table: application-level users and roles (separate from PostgreSQL roles).
-- Run connected to database "Graduation Project".

CREATE TABLE IF NOT EXISTS app_users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role       VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);

COMMENT ON TABLE app_users IS 'Application users; role can be admin or user.';
