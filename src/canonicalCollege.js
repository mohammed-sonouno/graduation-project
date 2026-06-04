/**
 * College/faculty labels for UI filters and profile display.
 *
 * Authoritative faculty strings for Engineering vs IT/AI live in `config/rules.js`.
 * Strict pair for IEEE governance / normalization: `ENGINEERING_SCOPE_CANONICAL_FACULTIES` (re-exported below).
 * `CANONICAL_FACULTY_NAMES` includes additional Najah faculties for academic catalogue routes.
 */

import {
  FACULTY_ENGINEERING_CANONICAL,
  FACULTY_IT_AI_CANONICAL,
  ENGINEERING_SCOPE_CANONICAL_FACULTIES,
} from '../config/rules.js';

export { ENGINEERING_SCOPE_CANONICAL_FACULTIES };

/** @type {typeof FACULTY_ENGINEERING_CANONICAL} */
export const FACULTY_ENGINEERING = FACULTY_ENGINEERING_CANONICAL;

/** @type {typeof FACULTY_IT_AI_CANONICAL} */
export const FACULTY_IT_AI = FACULTY_IT_AI_CANONICAL;

/** Ordered list used for dropdowns (subset returned depends on GET /api/colleges rows). */
export const CANONICAL_FACULTY_NAMES = [
  FACULTY_ENGINEERING,
  FACULTY_IT_AI,
  'Faculty of Medicine and Health Sciences',
  'Faculty of Science',
  'Faculty of Pharmacy',
  'Faculty of Nursing',
  'Faculty of Optometry',
  'Faculty of Veterinary Medicine',
  'Faculty of Agriculture',
  'Faculty of Arts',
  'Faculty of Educational Sciences and Teacher Training',
  'Faculty of Law',
  'Faculty of Economics and Social Sciences',
  'Faculty of Fine Arts',
  'Faculty of Physical Education and Sports Sciences',
  'Faculty of Sharia Sciences',
];

const CANONICAL_SET = new Set(CANONICAL_FACULTY_NAMES);

/**
 * Lowercase legacy strings → canonical DB-facing faculty name.
 * Engineering aliases MUST match 042_faculties_normalize_final.sql VALUES lists.
 */
/** Majors that belong to IT & AI (not Faculty of Engineering). */
export const IT_AI_MAJOR_NAMES_LOWER = new Set([
  'computer science',
  'management information systems',
  'information technology',
  'software engineering',
  'cybersecurity',
  'cyber security',
  'ai and data science',
  'artificial intelligence and data science',
  'computer information systems',
  'computer science apprenticeship program',
]);

const LEGACY_TO_CANONICAL = {
  engineering: FACULTY_ENGINEERING,
  'faculty of engineering': FACULTY_ENGINEERING,
  // Legacy combined label — use resolveStudentFaculty(college, major) instead of mapping here.

  it: FACULTY_IT_AI,
  'information technology': FACULTY_IT_AI,
  'faculty of information technology & artificial intelligence': FACULTY_IT_AI,
  cs: FACULTY_IT_AI,
  'computer science': FACULTY_IT_AI,
  cyber: FACULTY_IT_AI,
  cybersecurity: FACULTY_IT_AI,
  mis: FACULTY_IT_AI,
  'management information systems': FACULTY_IT_AI,
  'software engineering': FACULTY_IT_AI,
  'ai and data science': FACULTY_IT_AI,
  'artificial intelligence': FACULTY_IT_AI,

  'medicine & health': 'Faculty of Medicine and Health Sciences',
  'medicine and health': 'Faculty of Medicine and Health Sciences',
  'faculty of medicine and allied medical sciences': 'Faculty of Medicine and Health Sciences',
  'faculty of medicine and health sciences': 'Faculty of Medicine and Health Sciences',
  'faculty of dentistry & dental surgery': 'Faculty of Medicine and Health Sciences',

  'arts & sciences': 'Faculty of Science',
  'arts and sciences': 'Faculty of Science',
  'faculty of science': 'Faculty of Science',

  'business school': 'Faculty of Economics and Social Sciences',
  'faculty of business and communication': 'Faculty of Economics and Social Sciences',
  'faculty of economics and social sciences': 'Faculty of Economics and Social Sciences',

  'law & policy': 'Faculty of Law',
  'law and policy': 'Faculty of Law',
  'faculty of law': 'Faculty of Law',
  'faculty of law and political sciences': 'Faculty of Law',
  'law and political sciences': 'Faculty of Law',

  'faculty of pharmacy': 'Faculty of Pharmacy',
  'faculty of nursing': 'Faculty of Nursing',
  'faculty of optometry': 'Faculty of Optometry',
  'faculty of veterinary medicine': 'Faculty of Veterinary Medicine',
  'faculty of agriculture': 'Faculty of Agriculture',
  'faculty of arts': 'Faculty of Arts',
  'faculty of educational sciences and teacher training': 'Faculty of Educational Sciences and Teacher Training',
  'faculty of fine arts': 'Faculty of Fine Arts',
  'faculty of physical education and sports sciences': 'Faculty of Physical Education and Sports Sciences',

  "faculty of shari'ah": 'Faculty of Sharia Sciences',
  'faculty of shariah': 'Faculty of Sharia Sciences',
  'faculty of sharia sciences': 'Faculty of Sharia Sciences',

  'faculty of humanities and educational sciences': 'Faculty of Arts',
  'humanities and educational sciences': 'Faculty of Arts',
  'faculty of veterinary medicine and agricultural engineering': 'Faculty of Veterinary Medicine',
  'veterinary medicine and agricultural engineering': 'Faculty of Veterinary Medicine',
  'faculty of dentistry and dental surgery': 'Faculty of Medicine and Health Sciences',
};

/**
 * Normalize any stored college/faculty label to the canonical string used in PostgreSQL & filters.
 * @param {string|null|undefined} raw
 * @returns {string} Canonical name, or trimmed original if unknown.
 */
export function normalizeCollege(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t) return '';
  const lower = t.toLowerCase();
  if (LEGACY_TO_CANONICAL[lower]) return LEGACY_TO_CANONICAL[lower];
  const hit = CANONICAL_FACULTY_NAMES.find((c) => c.toLowerCase() === lower);
  if (hit) return hit;
  return t;
}

/**
 * Faculty for a major name (catalogue truth: MIS/CS → IT, Civil/Mechanical → Engineering).
 * @param {string|null|undefined} majorName
 * @returns {string} Canonical faculty name or '' if unknown.
 */
export function facultyForMajorName(majorName) {
  if (!majorName || typeof majorName !== 'string') return '';
  const lower = majorName.trim().toLowerCase();
  if (!lower) return '';
  if (IT_AI_MAJOR_NAMES_LOWER.has(lower)) return FACULTY_IT_AI;
  if (
    lower.includes('engineering') ||
    lower.includes('architect') ||
    lower.includes('geomatic') ||
    lower.includes('surveying')
  ) {
    if (lower === 'software engineering') return FACULTY_IT_AI;
    return FACULTY_ENGINEERING;
  }
  return '';
}

/**
 * Student's faculty: major wins over legacy combined college labels.
 * @param {string|null|undefined} collegeName
 * @param {string|null|undefined} majorName
 * @returns {string} Canonical faculty for display, RBAC, and event audience.
 */
export function resolveStudentFaculty(collegeName, majorName) {
  const fromMajor = facultyForMajorName(majorName);
  if (fromMajor) return fromMajor;

  const c = typeof collegeName === 'string' ? collegeName.trim() : '';
  if (!c) return '';

  const lower = c.toLowerCase();
  if (
    lower === 'engineering & it' ||
    lower === 'engineering and it' ||
    lower === 'faculty of engineering and information technology'
  ) {
    return '';
  }

  const canon = normalizeCollege(c);
  if (canon === FACULTY_ENGINEERING || canon === FACULTY_IT_AI) return canon;
  return canon || c;
}

/** @param {{ facultyName?: string, name?: string }} major */
export function canonicalFacultyForMajor(major) {
  const n = major.name || '';
  const fromName = facultyForMajorName(n);
  if (fromName) return fromName;

  const fn = major.facultyName || '';

  if (fn === 'Faculty of Engineering' || fn === 'Faculty of Engineering and Information Technology') {
    return FACULTY_ENGINEERING;
  }
  if (fn === 'Faculty of Information Technology & Artificial Intelligence') {
    return FACULTY_IT_AI;
  }

  if (fn === 'Faculty of Law and Political Sciences') return 'Faculty of Law';

  if (fn === 'Faculty of Business and Communication') return 'Faculty of Economics and Social Sciences';

  if (fn === 'Faculty of Shari\'ah') return 'Faculty of Sharia Sciences';

  if (fn.includes('Medicine and Allied Medical')) {
    if (/^Optometry$/i.test(n.trim())) return 'Faculty of Optometry';
    if (/^Nursing$/i.test(n.trim())) return 'Faculty of Nursing';
    return 'Faculty of Medicine and Health Sciences';
  }

  if (fn === 'Faculty of Dentistry & Dental Surgery') return 'Faculty of Medicine and Health Sciences';

  if (fn.includes('Veterinary Medicine and Agricultural')) {
    if (/Plant Production|Nutrition and Food/i.test(n)) return 'Faculty of Agriculture';
    return 'Faculty of Veterinary Medicine';
  }

  if (fn === 'Faculty of Humanities and Educational Sciences') {
    if (/Physical Education/i.test(n) && !/\/ Education/i.test(n)) {
      return 'Faculty of Physical Education and Sports Sciences';
    }
    if (/Kindergarten|Inclusive and Special|Early Childhood|\/ Education/i.test(n)) {
      return 'Faculty of Educational Sciences and Teacher Training';
    }
    return 'Faculty of Arts';
  }

  return normalizeCollege(fn) || fn;
}

export function eventCollegeMatchesCanonical(eventCollegeName, selectedCanonicalOrAll) {
  if (!selectedCanonicalOrAll || selectedCanonicalOrAll === 'All Colleges') return true;
  return normalizeCollege(eventCollegeName || '') === selectedCanonicalOrAll;
}

function engineeringOrganizerHints(event) {
  if (!event || typeof event !== 'object') return [];
  return [event.organizer, event.organizerName, event.clubName, event.communityName]
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter(Boolean);
}

export function eventMatchesCollegeFilter(event, selectedCanonicalOrAll) {
  if (!selectedCanonicalOrAll || selectedCanonicalOrAll === 'All Colleges') return true;
  if (eventCollegeMatchesCanonical(event.collegeName, selectedCanonicalOrAll)) return true;
  // IEEE is governed under Faculty of Engineering — show under Engineering college filter only.
  if (selectedCanonicalOrAll === FACULTY_ENGINEERING) {
    if (engineeringOrganizerHints(event).some((s) => s.includes('ieee'))) return true;
  }
  return false;
}

function majorCountForCollege(majors, rowId) {
  if (!Array.isArray(majors)) return 0;
  const sid = String(rowId);
  let n = 0;
  for (const m of majors) {
    if (!m) continue;
    const cid = m.collegeId ?? m.college_id;
    if (cid != null && String(cid) === sid) n++;
  }
  return n;
}

/**
 * One dropdown row per canonical faculty present in API data.
 * @param {{ id: unknown, name?: string }[]} rows
 * @param {{ collegeId?: unknown, college_id?: unknown }[] | null | undefined} [majors]
 */
export function buildCanonicalCollegeOptions(rows, majors = null) {
  const list = Array.isArray(rows) ? rows : [];
  /** @type {Map<string, { id: unknown, score: number }>} */
  const buckets = new Map();

  for (const row of list) {
    if (!row || row.name == null || String(row.name).trim() === '') continue;
    const canon = normalizeCollege(row.name);
    if (!CANONICAL_SET.has(canon)) continue;
    const mc = majorCountForCollege(majors, row.id);
    const nameBonus = String(row.name).trim() === canon ? 100 : 50;
    const score = mc * 1000 + nameBonus;
    const prev = buckets.get(canon);
    const idNum = Number(row.id);
    const prevNum = prev ? Number(prev.id) : Infinity;
    if (!prev || score > prev.score || (score === prev.score && idNum < prevNum)) {
      buckets.set(canon, { id: row.id, score });
    }
  }

  return CANONICAL_FACULTY_NAMES.filter((n) => buckets.has(n)).map((n) => ({
    id: buckets.get(n).id,
    name: n,
  }));
}

export function canonicalCollegeNamesFallback() {
  return [...CANONICAL_FACULTY_NAMES].sort((a, b) => a.localeCompare(b));
}
