/**
 * Single source of truth for faculty catalogue URLs (`/colleges/:slug`).
 * All faculty slug segments and paths must use these helpers — no duplicated slug logic elsewhere.
 */

export const COLLEGES_ROUTE_PREFIX = '/colleges';

/** Legacy path segments → canonical faculty **display name** (slugged via facultySlug). */
export const LEGACY_FACULTY_ROUTE_SLUGS = Object.freeze({
  'engineering-and-it': 'Faculty of Engineering',
});

/**
 * Deterministic slug for a faculty/catalogue card title.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function facultySlug(name) {
  if (name == null) return '';
  let s = String(name).trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/\s*&\s*/g, ' and ');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  s = s.replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

/**
 * @param {string|null|undefined} slug segment only (no slashes)
 * @returns {string} `/colleges` or `/colleges/:slug`
 */
export function collegePathFromFacultySlug(slug) {
  const s = String(slug ?? '').trim();
  return s ? `${COLLEGES_ROUTE_PREFIX}/${s}` : COLLEGES_ROUTE_PREFIX;
}

/** Decode and normalize a `:id` route param for comparison (lowercase). */
export function decodeFacultyRouteParam(rawParam) {
  try {
    return decodeURIComponent(String(rawParam ?? '').trim()).toLowerCase();
  } catch {
    return String(rawParam ?? '').trim().toLowerCase();
  }
}

/**
 * Resolves `:id` to the canonical catalogue slug matching `COLLEGES_CATALOG[].id`.
 * Applies legacy slug aliases (e.g. unified Engineering+IT card).
 * @param {string|null|undefined} rawParam
 * @returns {string}
 */
export function resolveCollegeCatalogSlug(rawParam) {
  const decoded = decodeFacultyRouteParam(rawParam);
  if (!decoded) return '';
  const legacyName = LEGACY_FACULTY_ROUTE_SLUGS[decoded];
  if (legacyName) return facultySlug(legacyName);
  return decoded;
}

export function shouldRedirectFacultySlugToCanonical(rawParam) {
  const decoded = decodeFacultyRouteParam(rawParam);
  if (!decoded) return false;
  return resolveCollegeCatalogSlug(rawParam) !== decoded;
}
