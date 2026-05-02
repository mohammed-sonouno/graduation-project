/**
 * Hooks for ML artifact versions. Runtime bot does not load models here yet;
 * set env vars after offline training + admin approval to track active generation.
 *
 * Examples:
 *   CHAT_ML_INTENT_MODEL_VERSION=2.1.0
 *   CHAT_ML_RANK_MODEL_VERSION=1.0.3
 */

const ENV_PREFIX = 'CHAT_ML_';

/**
 * @param {string} modelKey - e.g. intent, rank, synonym
 * @returns {string|null}
 */
export function getActiveModelVersionEnv(modelKey) {
  const k = String(modelKey || '')
    .trim()
    .replace(/[^a-z0-9_]/gi, '_')
    .toUpperCase();
  if (!k) return null;
  const v = process.env[`${ENV_PREFIX}${k}_MODEL_VERSION`];
  return v != null && String(v).trim() !== '' ? String(v).trim() : null;
}
