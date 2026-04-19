-- Controlled ML / training data collection for the integrated chatbot.
-- Append-only logs; no runtime behavior change except INSERT after each turn.
-- Review queue holds human-approved proposals before any learned change is applied.

BEGIN;

CREATE TABLE IF NOT EXISTS chat_ml_interaction_logs (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id       INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_message_id       INTEGER NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
  bot_message_id        INTEGER NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
  question_text         TEXT NOT NULL,
  reply_text            TEXT NOT NULL,
  detected_intent       VARCHAR(80) NULL,
  raw_intent            VARCHAR(80) NULL,
  plan_type             VARCHAR(80) NULL,
  reply_locale          VARCHAR(8) NULL,
  context_major_id      VARCHAR(100) NULL,
  context_program_key   VARCHAR(80) NULL,
  context_category      VARCHAR(32) NULL,
  user_gpa_hint         NUMERIC(5, 2) NULL,
  user_profile_major    TEXT NULL,
  answer_kind           VARCHAR(80) NULL,
  outcome               VARCHAR(32) NOT NULL,
  weak_reason           VARCHAR(64) NULL,
  debug_sources         JSONB NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_ml_interaction_logs_outcome_check CHECK (
    outcome IN ('success', 'weak', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_user_id ON chat_ml_interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_created_at ON chat_ml_interaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_outcome ON chat_ml_interaction_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_plan_type ON chat_ml_interaction_logs(plan_type);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_context_major ON chat_ml_interaction_logs(context_major_id);

CREATE TABLE IF NOT EXISTS chat_ml_feedback (
  id                    SERIAL PRIMARY KEY,
  interaction_log_id    INTEGER NOT NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  user_id               INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  helpful               BOOLEAN NULL,
  rating                SMALLINT NULL CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  comment               TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (interaction_log_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_ml_feedback_log ON chat_ml_feedback(interaction_log_id);

CREATE TABLE IF NOT EXISTS chat_ml_review_queue (
  id                    SERIAL PRIMARY KEY,
  interaction_log_id    INTEGER NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE SET NULL,
  proposal_type         VARCHAR(64) NOT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending',
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes           TEXT NULL,
  reviewed_by_user_id   INTEGER NULL REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_ml_review_queue_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'applied')
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_ml_review_status ON chat_ml_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_chat_ml_review_created ON chat_ml_review_queue(created_at DESC);

-- Aggregates for dashboards / Python export prep (read-only views)
CREATE OR REPLACE VIEW v_chat_ml_outcome_counts AS
SELECT
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY outcome;

CREATE OR REPLACE VIEW v_chat_ml_plan_frequency AS
SELECT
  COALESCE(plan_type, '(null)') AS plan_type,
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY plan_type, outcome;

CREATE OR REPLACE VIEW v_chat_ml_intent_frequency AS
SELECT
  COALESCE(detected_intent, '(null)') AS detected_intent,
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY detected_intent, outcome;

CREATE OR REPLACE VIEW v_chat_ml_weak_interactions AS
SELECT *
FROM chat_ml_interaction_logs
WHERE outcome IN ('weak', 'failed');

COMMIT;
