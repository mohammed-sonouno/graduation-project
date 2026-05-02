import { MAJORS_CATALOG } from './majorsCatalog';
import { canonicalFacultyForMajor, normalizeCollege } from '../canonicalCollege';
import { facultySlug, collegePathFromFacultySlug } from '../utils/facultySlug';

const DEFAULT_DESCRIPTION = 'Dedicated to excellence in teaching, research, and innovation.';

/** Catalogue-only grouping: Engineering vs IT/AI are separate cards; DB rows match after migrate 048. */
export const CATALOG_SPLIT_ENGINEERING = 'Faculty of Engineering';
export const CATALOG_SPLIT_IT_AI = 'Faculty of Information Technology & Artificial Intelligence';

const SPLIT_FACULTIES = new Set([CATALOG_SPLIT_ENGINEERING, CATALOG_SPLIT_IT_AI]);

/**
 * Faculty bucket key for `/colleges` catalogue pages only.
 * Uses catalogue major.facultyName for Engineering vs IT; canonical mapping elsewhere unchanged.
 * @param {{ facultyName?: string, name?: string }} major
 */
export function catalogFacultyGroupKey(major) {
  const fn = major?.facultyName || '';
  if (SPLIT_FACULTIES.has(fn)) return fn;
  return canonicalFacultyForMajor(major);
}

/**
 * Map a catalogue faculty card title to the corresponding `/api/colleges` row.
 * @param {string} catalogFacultyName
 * @param {{ id?: unknown, name?: string }[]} apiRows
 */
export function resolveApiCollegeRow(catalogFacultyName, apiRows) {
  const list = Array.isArray(apiRows) ? apiRows : [];
  const canon = normalizeCollege(catalogFacultyName);
  const matches = list.filter((r) => normalizeCollege(r?.name) === canon);
  if (matches.length === 0) {
    return (
      list.find((r) => String(r?.name || '').trim() === String(catalogFacultyName || '').trim()) ||
      null
    );
  }
  matches.sort((a, b) => Number(a.id) - Number(b.id));
  return matches[0];
}

/** Short blurbs keyed by canonical faculty name (matches DB colleges.name). */
export const FACULTY_DESCRIPTIONS = {
  [CATALOG_SPLIT_ENGINEERING]:
    'Engineering disciplines — civil, mechanical, electrical, chemical, biomedical, and related fields.',
  [CATALOG_SPLIT_IT_AI]:
    'Computing and digital sciences — computer science, software engineering, cybersecurity, MIS, AI and data science.',
  'Faculty of Medicine and Health Sciences':
    'Medicine and allied health professions; clinical education and healthcare sciences.',
  'Faculty of Science': 'Natural sciences: mathematics, physics, chemistry, life sciences, and related fields.',
  'Faculty of Pharmacy': 'Pharmaceutical sciences and clinical pharmacy.',
  'Faculty of Nursing': 'Nursing practice, patient care, and health promotion.',
  'Faculty of Optometry': 'Vision science, eye health, and optometric practice.',
  'Faculty of Veterinary Medicine': 'Veterinary medicine and animal health.',
  'Faculty of Agriculture': 'Crop science, plant protection, food technology, and agricultural production.',
  'Faculty of Arts': 'Languages, literature, humanities, tourism, geography, and social studies.',
  'Faculty of Educational Sciences and Teacher Training':
    'Teacher education, inclusive education, and pedagogical sciences.',
  'Faculty of Law': 'Legal studies and governance.',
  'Faculty of Economics and Social Sciences':
    'Economics, business, accounting, finance, marketing, media, and communication.',
  'Faculty of Fine Arts': 'Visual arts, music, interior design, and creative practice.',
  'Faculty of Physical Education and Sports Sciences':
    'Physical education, sport science, and movement studies.',
  'Faculty of Sharia Sciences': 'Islamic jurisprudence, theology, and Sharia-compliant disciplines.',
};

export function descriptionForFaculty(name) {
  if (name && FACULTY_DESCRIPTIONS[name]) return FACULTY_DESCRIPTIONS[name];
  const canon = normalizeCollege(name);
  return FACULTY_DESCRIPTIONS[canon] || DEFAULT_DESCRIPTION;
}

/** Programs grouped for catalogue/colleges UI (Engineering vs IT split; matches majors catalogue faculty names). */
export const COLLEGES_CATALOG = Array.from(
  MAJORS_CATALOG.reduce((acc, major) => {
    const key = catalogFacultyGroupKey(major);
    if (!key) return acc;
    if (!acc.has(key)) {
      acc.set(key, {
        id: facultySlug(key),
        name: key,
        description: descriptionForFaculty(key),
        majors: [],
      });
    }
    acc.get(key).majors.push(major);
    return acc;
  }, new Map()).values()
).sort((a, b) => a.name.localeCompare(b.name));

function catalogEntryForMajorFacultyName(facultyName) {
  const fn = facultyName ? String(facultyName).trim() : '';
  if (!fn) return null;
  return (
    COLLEGES_CATALOG.find((c) => (c.majors || []).some((m) => m.facultyName === fn)) ?? null
  );
}

/** Catalogue card title for this majors-catalog faculty row (canonical routing bucket name). */
export function catalogCollegeBucketNameForMajorFaculty(facultyName) {
  return catalogEntryForMajorFacultyName(facultyName)?.name ?? '';
}

/**
 * Canonical catalogue slug for `/colleges/:slug` from a majors-catalog `facultyName`.
 * @param {string} facultyName
 * @returns {string}
 */
export function catalogCollegeSlugForMajorFaculty(facultyName) {
  const entry = catalogEntryForMajorFacultyName(facultyName);
  return entry ? facultySlug(entry.name) : '';
}

/** Public href for breadcrumbs / links from catalogue majors faculty label. */
export function catalogCollegePathForMajorFaculty(facultyName) {
  return collegePathFromFacultySlug(catalogCollegeSlugForMajorFaculty(facultyName));
}
