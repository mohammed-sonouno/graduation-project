import { TtlCache } from '../cache/ttlCache.js';
import { perfConfig } from './config.js';

/**
 * Optional TTL cache for public, non-sensitive catalog data (engineering programs list).
 * Disabled unless CHATBOT_ENABLE_CACHE=1 — returns null so callers skip caching.
 */

let programsCatalogCache = null;

export function getProgramsCatalogCache() {
  if (!perfConfig.enablePublicCatalogCache) return null;
  if (!programsCatalogCache) {
    programsCatalogCache = new TtlCache({
      ttlMs: perfConfig.programsCacheTtlMs,
      max: perfConfig.cacheMaxEntries
    });
  }
  return programsCatalogCache;
}

/** For tests only: reset singleton. */
export function __resetProgramsCatalogCacheForTests() {
  programsCatalogCache = null;
}

