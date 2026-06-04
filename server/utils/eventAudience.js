import { resolveStudentFaculty } from '../../src/canonicalCollege.js';

async function collegeIdsForCanonicalFaculty(pool, canonicalName) {
  if (!canonicalName) return new Set();
  const r = await pool.query(
    'SELECT id FROM colleges WHERE lower(trim(name)) = lower(trim($1))',
    [canonicalName]
  );
  const ids = new Set();
  for (const row of r.rows) {
    if (row.id != null) ids.add(Number(row.id));
  }
  return ids;
}

/** Resolve college row ids for this student (one canonical faculty from college + major). */
export async function resolveStudentCollegeIds(pool, collegeName, majorName) {
  const faculty = resolveStudentFaculty(collegeName, majorName);
  return collegeIdsForCanonicalFaculty(pool, faculty);
}

async function canonicalNamesForCollegeIds(pool, idList) {
  const nums = [...idList].map(Number).filter((n) => !Number.isNaN(n));
  if (!nums.length) return new Set();
  const r = await pool.query('SELECT name FROM colleges WHERE id = ANY($1::int[])', [nums]);
  const names = new Set();
  for (const row of r.rows) {
    const faculty = resolveStudentFaculty(row.name, null);
    if (faculty) names.add(faculty);
  }
  return names;
}

/** @param {import('pg').Pool} pool */
export async function canStudentJoinEvent(pool, eventRow, collegeName, majorName) {
  const forAllColleges = eventRow.for_all_colleges !== false;
  if (forAllColleges) return true;

  const targetCollegeIds = Array.isArray(eventRow.target_college_ids)
    ? eventRow.target_college_ids
    : eventRow.target_college_ids
      ? JSON.parse(JSON.stringify(eventRow.target_college_ids))
      : [];
  if (targetCollegeIds.length === 0) return true;

  const studentFaculty = resolveStudentFaculty(collegeName, majorName);
  if (!studentFaculty) return false;

  const targetCanon = await canonicalNamesForCollegeIds(pool, targetCollegeIds);
  if (!targetCanon.has(studentFaculty)) return false;

  const targetAllMajors = eventRow.target_all_majors !== false;
  if (targetAllMajors) return true;

  const targetMajorIds = Array.isArray(eventRow.target_major_ids)
    ? eventRow.target_major_ids
    : eventRow.target_major_ids
      ? JSON.parse(JSON.stringify(eventRow.target_major_ids))
      : [];
  if (targetMajorIds.length === 0) return true;

  const majorTrim = typeof majorName === 'string' ? majorName.trim() : '';
  if (!majorTrim) return false;

  const majRows = await pool.query(
    'SELECT id FROM majors WHERE lower(trim(name)) = lower(trim($1))',
    [majorTrim]
  );
  if (majRows.rows.length === 0) return false;

  return majRows.rows.some((row) => targetMajorIds.some((tid) => Number(tid) === Number(row.id)));
}
