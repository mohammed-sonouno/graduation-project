-- Training signals, analytics views, and human gold labels for controlled ML.
-- Runtime chatbot behavior is unchanged; only extra columns on INSERT and review tooling.

BEGIN;

ALTER TABLE chat_ml_interaction_logs
  ADD COLUMN IF NOT EXISTS answer_validation_ok BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS mismatch_blocked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chat_ml_interaction_logs.answer_validation_ok IS
  'NULL if no validator ran; true/false from answer/plan alignment check.';
COMMENT ON COLUMN chat_ml_interaction_logs.mismatch_blocked IS
  'True when a draft/plan mismatch was blocked and reply was replaced (safety).';

CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_weak_reason ON chat_ml_interaction_logs(weak_reason);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_reply_locale ON chat_ml_interaction_logs(reply_locale);
CREATE INDEX IF NOT EXISTS idx_chat_ml_logs_mismatch ON chat_ml_interaction_logs(mismatch_blocked) WHERE mismatch_blocked = TRUE;

-- Gold labels from reviewers (optional; used to build supervised datasets). Not applied to runtime bot.
CREATE TABLE IF NOT EXISTS chat_ml_labeled_examples (
  id                     SERIAL PRIMARY KEY,
  interaction_log_id     INTEGER NOT NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  labeled_by_user_id     INTEGER NULL REFERENCES app_users(id) ON DELETE SET NULL,
  gold_intent            VARCHAR(80) NULL,
  gold_entities          JSONB NULL,
  label_notes            TEXT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (interaction_log_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_ml_labeled_intent ON chat_ml_labeled_examples(gold_intent);

CREATE OR REPLACE VIEW v_chat_ml_weak_reason_counts AS
SELECT
  COALESCE(weak_reason, '(null)') AS weak_reason,
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY weak_reason, outcome;

CREATE OR REPLACE VIEW v_chat_ml_answer_kind_frequency AS
SELECT
  COALESCE(answer_kind, '(null)') AS answer_kind,
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY answer_kind, outcome;

CREATE OR REPLACE VIEW v_chat_ml_locale_frequency AS
SELECT
  COALESCE(reply_locale, '(null)') AS reply_locale,
  outcome,
  COUNT(*)::bigint AS cnt
FROM chat_ml_interaction_logs
GROUP BY reply_locale, outcome;

CREATE OR REPLACE VIEW v_chat_ml_feedback_summary AS
SELECT
  COUNT(*)::bigint AS feedback_rows,
  COUNT(*) FILTER (WHERE helpful IS TRUE)::bigint AS helpful_yes,
  COUNT(*) FILTER (WHERE helpful IS FALSE)::bigint AS helpful_no,
  COUNT(*) FILTER (WHERE helpful IS NULL)::bigint AS helpful_unset,
  ROUND(AVG(rating)::numeric, 3) AS avg_rating,
  COUNT(*) FILTER (WHERE rating IS NOT NULL)::bigint AS rated_count
FROM chat_ml_feedback;

-- Join view for exporting rows that have human intent labels (supervised intent training)
CREATE OR REPLACE VIEW v_chat_ml_supervised_intent_rows AS
SELECT
  l.id AS log_id,
  l.question_text,
  l.reply_text,
  l.detected_intent,
  l.raw_intent,
  l.plan_type,
  l.reply_locale,
  l.context_major_id,
  l.context_program_key,
  l.context_category,
  l.answer_kind,
  l.outcome,
  l.weak_reason,
  l.answer_validation_ok,
  l.mismatch_blocked,
  l.debug_sources,
  l.created_at AS logged_at,
  g.gold_intent,
  g.gold_entities,
  g.label_notes,
  g.labeled_by_user_id,
  g.created_at AS labeled_at
FROM chat_ml_interaction_logs l
INNER JOIN chat_ml_labeled_examples g ON g.interaction_log_id = l.id
WHERE g.gold_intent IS NOT NULL;

COMMIT;
