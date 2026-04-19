import { pool } from '../../db/pool.js';
import { EngineeringProgramsRepository } from '../../repositories/engineeringPrograms.repository.js';
import { MajorChatContextRepository } from '../../repositories/majorChatContext.repository.js';

const ENGINEERING_COLLEGE_ID = 1;

function normalizeJsonArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (v && typeof v === 'object' && Array.isArray(v.value)) return v.value.map((x) => String(x));
  return [];
}

/**
 * @param {string|null|undefined} majorId
 * @param {{ engineeringRepo?: EngineeringProgramsRepository, majorChatRepo?: MajorChatContextRepository }} [repos]
 */
export async function resolveMajorPageContext(majorId, repos = {}) {
  const engineeringRepo = repos.engineeringRepo || new EngineeringProgramsRepository();
  const majorChatRepo = repos.majorChatRepo || new MajorChatContextRepository();

  if (majorId == null || String(majorId).trim() === '') return null;

  const id = String(majorId).trim();
  const r = await pool.query(
    `SELECT m.id AS "majorId", m.name AS "majorName", m.college_id AS "collegeId", c.name AS "collegeName"
     FROM majors m
     JOIN colleges c ON c.id = m.college_id
     WHERE m.id = $1`,
    [id]
  );
  const row = r.rows[0];
  if (!row) return null;

  const ctx = await majorChatRepo.getByMajorId(row.majorId);
  let programKey = ctx?.engineeringProgramKey || null;

  if (!programKey && Number(row.collegeId) === ENGINEERING_COLLEGE_ID) {
    const hits = await engineeringRepo.searchByKeyword({ q: row.majorName, limit: 5 });
    programKey = hits[0]?.programKey || null;
    if (!programKey && row.majorName) {
      const token = String(row.majorName).split(/\s+/).filter((t) => t.length >= 3)[0];
      if (token) {
        const h2 = await engineeringRepo.searchByKeyword({ q: token, limit: 5 });
        programKey = h2[0]?.programKey || null;
      }
    }
  }

  return {
    majorId: row.majorId,
    majorName: row.majorName,
    collegeId: row.collegeId,
    collegeName: row.collegeName,
    category: ctx?.category || 'other',
    programKey,
    greetingEn: ctx?.greetingEn || null,
    greetingAr: ctx?.greetingAr || null,
    suggestedQuestionsEn: normalizeJsonArray(ctx?.suggestedQuestionsEn),
    suggestedQuestionsAr: normalizeJsonArray(ctx?.suggestedQuestionsAr),
    factsEn: ctx?.factsEn || null,
    factsAr: ctx?.factsAr || null
  };
}
