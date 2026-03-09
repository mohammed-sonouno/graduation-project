-- Generic module data: store keyed JSON per module (and optional user) for future features.
-- Use this for any new "module" (e.g. settings, feature flags, module-specific state) without new tables.
-- module_name: e.g. 'surveys', 'preferences'; user_id NULL = app-level/global.

CREATE TABLE IF NOT EXISTS app_module_data (
  id          SERIAL PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  user_id     INTEGER NULL REFERENCES app_users(id) ON DELETE CASCADE,
  key         VARCHAR(255) NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user: one row per (module_name, user_id, key). Global: one row per (module_name, key) when user_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_data_unique_user
  ON app_module_data (module_name, user_id, key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_data_unique_global
  ON app_module_data (module_name, key) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_module_data_module ON app_module_data(module_name);
CREATE INDEX IF NOT EXISTS idx_module_data_user ON app_module_data(module_name, user_id);
CREATE INDEX IF NOT EXISTS idx_module_data_updated ON app_module_data(module_name, updated_at DESC);

COMMENT ON TABLE app_module_data IS 'Key-value store per module: module_name + optional user_id + key -> value (JSON). Use for user preferences, feature flags, or any future module.';
