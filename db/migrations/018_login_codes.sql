-- One-time 6-digit login codes sent by email. Replaces password for sign-in flow.
CREATE TABLE IF NOT EXISTS login_codes (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  code       VARCHAR(6)   NOT NULL,
  expires_at TIMESTAMPTZ   NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes (email);
CREATE INDEX IF NOT EXISTS idx_login_codes_expires ON login_codes (expires_at);

COMMENT ON TABLE login_codes IS 'One-time 6-digit codes for email login; delete or expire after use.';
