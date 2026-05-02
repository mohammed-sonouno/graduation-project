import 'dotenv/config';

/**
 * Centralized, reversible performance-related settings (env-driven).
 * Safe defaults preserve previous behavior unless flags are explicitly enabled.
 */

function envBool(name, defaultValue = false) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function envInt(name, defaultValue) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : defaultValue;
}

export const perfConfig = {
  /** When true, caches public engineering program rows (no user data). Default off. */
  enablePublicCatalogCache: envBool('CHATBOT_ENABLE_CACHE', false),

  programsCacheTtlMs: envInt('CHATBOT_PROGRAMS_CACHE_TTL_MS', 60_000),
  cacheMaxEntries: envInt('CHATBOT_CACHE_MAX_ENTRIES', 100),

  eventsCountCacheTtlMs: envInt('CHATBOT_EVENTS_COUNT_CACHE_TTL_MS', 15_000),
  eventsCountCacheMax: envInt('CHATBOT_EVENTS_COUNT_CACHE_MAX', 200),

  /** Log JSON lines for HTTP + chat engine timing (development-oriented). */
  perfLog: envBool('CHATBOT_PERF_LOG', false),

  verboseDebugLogs: envBool('CHATBOT_DEBUG_LOGS', false),

  /** Reserved: max-age seconds for future public schema metadata endpoint (unused until exposed). */
  schemaInfoMaxAgeSeconds: envInt('CHATBOT_SCHEMA_INFO_MAX_AGE_SECONDS', 0)
};

/** Used for chatbot list limits (events, communities, notifications, …). */
export function resolveQueryListLimit() {
  const direct = Number(process.env.CHATBOT_MAX_ITEMS);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const alt = Number(process.env.CHATBOT_QUERY_LIMIT_DEFAULT);
  if (Number.isFinite(alt) && alt > 0) return Math.floor(alt);
  return 5;
}

