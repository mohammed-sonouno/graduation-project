-- Controlled learning schema: normalized logs, knowledge allowlist, model registry.
-- Runtime bot still reads only via existing repositories; this catalog documents what is safe.
-- No triggers that change answers; append-only sidecar rows per interaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- Approved knowledge surface (curated; expand only via migration or admin review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_knowledge_allowlist (
  id                 SERIAL PRIMARY KEY,
  table_schema       VARCHAR(64) NOT NULL DEFAULT 'public',
  table_name         VARCHAR(128) NOT NULL,
  column_name        VARCHAR(128) NOT NULL DEFAULT '*',
  domain             VARCHAR(64) NOT NULL,
  contains_pii       BOOLEAN NOT NULL DEFAULT FALSE,
  read_only          BOOLEAN NOT NULL DEFAULT TRUE,
  relation_notes     TEXT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_knowledge_allowlist_domain_check CHECK (
    domain IN (
      'university_knowledge',
      'faculty_knowledge',
      'engineering_programs',
      'major_page_context',
      'events',
      'communities',
      'notifications',
      'user_safe_profile',
      'operational',
      'logging_only'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_knowledge_allowlist_col
  ON chat_knowledge_allowlist (table_schema, table_name, column_name);

COMMENT ON TABLE chat_knowledge_allowlist IS
  'Allowlisted tables/columns the chatbot stack may read for factual answers; * = whole-table policy row.';

COMMENT ON COLUMN chat_knowledge_allowlist.column_name IS
  'Use * for table-level allowlist entry; specific column when row-level policy is documented.';

-- Seed allowlist (idempotent; * = whole table)
INSERT INTO chat_knowledge_allowlist (table_name, column_name, domain, contains_pii, relation_notes)
SELECT v.table_name, v.column_name, v.domain, v.contains_pii, v.relation_notes
FROM (
  VALUES
    ('university_qa', '*', 'university_knowledge', FALSE, 'Q&A chunks for university facts'),
    ('university_statistics', '*', 'university_knowledge', FALSE, 'Aggregates'),
    ('university_timeline', '*', 'university_knowledge', FALSE, 'Timeline rows'),
    ('university_profiles', '*', 'university_knowledge', FALSE, 'Profile text'),
    ('faculty_qa', '*', 'faculty_knowledge', FALSE, 'Faculty Q&A'),
    ('faculty_statistics', '*', 'faculty_knowledge', FALSE, 'Faculty stats'),
    ('engineering_programs', '*', 'engineering_programs', FALSE, 'Program catalogue / admission bands'),
    ('major_chat_context', '*', 'major_page_context', FALSE, 'Per-major chat context'),
    ('events', '*', 'events', FALSE, 'Event listings'),
    ('communities', '*', 'communities', FALSE, 'Communities / clubs'),
    ('colleges', '*', 'operational', FALSE, 'Joined for community display'),
    ('notifications', '*', 'notifications', FALSE, 'User notifications'),
    ('event_registrations', '*', 'notifications', FALSE, 'User event registrations'),
    ('app_users', '*', 'user_safe_profile', TRUE, 'Strictly via user_safe projection; no passwords'),
    ('student_profiles', '*', 'user_safe_profile', TRUE, 'Academic hints only via controlled repo'),
    ('chat_conversations', '*', 'logging_only', TRUE, 'Conversation metadata'),
    ('chat_messages', '*', 'logging_only', FALSE, 'Message history'),
    ('chat_ml_interaction_logs', '*', 'logging_only', TRUE, 'ML logs may hold question text'),
    ('chat_question_logs', '*', 'logging_only', FALSE, 'Question sidecar'),
    ('chat_answer_logs', '*', 'logging_only', FALSE, 'Answer sidecar'),
    ('chat_entity_logs', '*', 'logging_only', FALSE, 'Entity snapshots'),
    ('chat_unanswered', '*', 'logging_only', FALSE, 'Weak/failed index'),
    ('chat_training_samples', '*', 'logging_only', FALSE, 'Training curation'),
    ('chat_ml_model_registry', '*', 'logging_only', FALSE, 'Model registry metadata')
) AS v(table_name, column_name, domain, contains_pii, relation_notes)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_knowledge_allowlist k
  WHERE k.table_schema = 'public'
    AND k.table_name = v.table_name
    AND k.column_name = v.column_name
);

-- ---------------------------------------------------------------------------
-- Normalized question / answer / entity logs (1:1 with chat_ml_interaction_logs.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_question_logs (
  id SERIAL PRIMARY KEY,
  interaction_log_id          INTEGER NOT NULL UNIQUE REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  user_id                     INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  conversation_id             INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_message_id             INTEGER NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
  parent_interaction_log_id   INTEGER NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE SET NULL,
  question_text               TEXT NOT NULL,
  detected_intent             VARCHAR(80) NULL,
  raw_intent                  VARCHAR(80) NULL,
  reply_locale                VARCHAR(8) NULL,
  context_major_id            VARCHAR(100) NULL,
  context_program_key         VARCHAR(80) NULL,
  context_category            VARCHAR(32) NULL,
  extracted_entities          JSONB NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_question_logs_conv ON chat_question_logs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_question_logs_parent ON chat_question_logs(parent_interaction_log_id);

CREATE TABLE IF NOT EXISTS chat_answer_logs (
  id                   SERIAL PRIMARY KEY,
  interaction_log_id INTEGER NOT NULL UNIQUE REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  bot_message_id       INTEGER NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
  reply_text           TEXT NOT NULL,
  answer_kind          VARCHAR(80) NULL,
  plan_type            VARCHAR(80) NULL,
  fallback_used        BOOLEAN NOT NULL DEFAULT FALSE,
  weak_or_offtopic     BOOLEAN NOT NULL DEFAULT FALSE,
  validation_ok        BOOLEAN NULL,
  mismatch_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  pipeline_sources     JSONB NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_answer_logs_fallback ON chat_answer_logs(fallback_used) WHERE fallback_used = TRUE;
CREATE INDEX IF NOT EXISTS idx_chat_answer_logs_weak ON chat_answer_logs(weak_or_offtopic) WHERE weak_or_offtopic = TRUE;

CREATE TABLE IF NOT EXISTS chat_entity_logs (
  id SERIAL PRIMARY KEY,
  interaction_log_id   INTEGER NOT NULL UNIQUE REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  entities             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weak / failed turns for ML mining (denormalized pointer; optional filter views)
CREATE TABLE IF NOT EXISTS chat_unanswered (
  id                   SERIAL PRIMARY KEY,
  interaction_log_id   INTEGER NOT NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  outcome              VARCHAR(32) NOT NULL,
  weak_reason          VARCHAR(64) NULL,
  category             VARCHAR(64) NOT NULL DEFAULT 'weak_or_failed',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_unanswered_outcome_check CHECK (outcome IN ('weak', 'failed')),
  CONSTRAINT chat_unanswered_interaction_unique UNIQUE (interaction_log_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_unanswered_category ON chat_unanswered(category);

-- Curated or auto-flagged training rows (promotion is human or batch job; not live bot)
CREATE TABLE IF NOT EXISTS chat_training_samples (
  id SERIAL PRIMARY KEY,
  interaction_log_id   INTEGER NOT NULL REFERENCES chat_ml_interaction_logs(id) ON DELETE CASCADE,
  sample_status        VARCHAR(32) NOT NULL DEFAULT 'auto_flagged',
  flag_reason          VARCHAR(128) NULL,
  target_model_key     VARCHAR(64) NULL,
  export_batch_id      VARCHAR(64) NULL,
  promoted_at          TIMESTAMPTZ NULL,
  notes                TEXT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_training_samples_status_check CHECK (
    sample_status IN ('raw', 'auto_flagged', 'promoted', 'exported', 'discarded')
  ),
  CONSTRAINT chat_training_samples_log_unique UNIQUE (interaction_log_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_training_samples_status ON chat_training_samples(sample_status);
CREATE INDEX IF NOT EXISTS idx_chat_training_samples_export ON chat_training_samples(export_batch_id);

-- ---------------------------------------------------------------------------
-- Model / config versioning (offline training artifacts; no auto-activate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_ml_model_registry (
  id SERIAL PRIMARY KEY,
  model_key              VARCHAR(64) NOT NULL,
  version                VARCHAR(64) NOT NULL,
  artifact_uri           TEXT NULL,
  status                 VARCHAR(32) NOT NULL DEFAULT 'draft',
  approved_by_user_id    INTEGER NULL REFERENCES app_users(id) ON DELETE SET NULL,
  approved_at            TIMESTAMPTZ NULL,
  activated_at           TIMESTAMPTZ NULL,
  retired_at             TIMESTAMPTZ NULL,
  notes                  TEXT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_ml_model_registry_status_check CHECK (
    status IN ('draft', 'pending_review', 'approved', 'active', 'retired')
  ),
  CONSTRAINT chat_ml_model_registry_model_version_unique UNIQUE (model_key, version)
);

CREATE INDEX IF NOT EXISTS idx_chat_ml_model_registry_key_status ON chat_ml_model_registry(model_key, status);

COMMENT ON TABLE chat_ml_model_registry IS
  'Registered ML artifacts; only promote to active after human approval and deploy.';

-- ---------------------------------------------------------------------------
-- Friendly view: feedback under name chat_feedback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW chat_feedback AS
SELECT
  id,
  interaction_log_id,
  user_id,
  helpful,
  rating,
  comment,
  created_at
FROM chat_ml_feedback;

COMMIT;
