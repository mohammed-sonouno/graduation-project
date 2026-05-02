import { pool } from '../db/pool.js';

export class FacultyKnowledgeRepository {
  async identifyFacultyId({ terms = [] } = {}) {
    const fullText = Array.isArray(terms)
      ? terms.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean).join(' ')
      : '';
    if (fullText) {
      const direct = await pool.query(
        `SELECT id AS "facultyId"
         FROM faculty_profiles
         WHERE LOWER(COALESCE(official_name_en, '')) <> ''
           AND (
             $1 LIKE '%' || LOWER(official_name_en) || '%'
             OR EXISTS (
               SELECT 1
               FROM unnest(aliases) AS alias
               WHERE alias IS NOT NULL
                 AND alias <> ''
                 AND $1 LIKE '%' || LOWER(alias) || '%'
             )
           )
         ORDER BY LENGTH(official_name_en) DESC, id ASC
         LIMIT 1`,
        [fullText]
      );
      if (direct.rows[0]?.facultyId != null) {
        return direct.rows[0].facultyId;
      }
    }

    const genericTerms = new Set([
      'faculty', 'college', 'program', 'programs', 'programme', 'programmes',
      'major', 'majors', 'about', 'info', 'information', 'tell', 'what',
      'كلية', 'برنامج', 'برامج', 'تخصص', 'تخصصات', 'التخصصات', 'البرامج',
      'عن', 'معلومات', 'ما', 'شو', 'الموجودة', 'موجود'
    ]);
    const cleanTerms = Array.isArray(terms)
      ? terms.map((t) => String(t || '').trim().toLowerCase()).filter((t) => t && !genericTerms.has(t))
      : [];
    if (!cleanTerms.length) return null;
    const r = await pool.query(
      `SELECT faculty_id AS "facultyId",
              COUNT(DISTINCT keyword_hit.keyword)::int AS score
       FROM faculty_qa
       CROSS JOIN LATERAL unnest(keywords) AS keyword_hit(keyword)
       WHERE keyword_hit.keyword = ANY ($1::text[])
       GROUP BY faculty_id
       ORDER BY score DESC, "facultyId" ASC
       LIMIT 1`,
      [cleanTerms]
    );
    return r.rows[0]?.facultyId ?? null;
  }

  async searchQA({ terms = [], limit = 3, facultyId = null } = {}) {
    if (!terms.length) return [];
    const likeTerms = terms.filter(t => t.length >= 3);
    const likeBaseIndex = facultyId != null ? 4 : 3;
    const likeCols = `COALESCE(question_en,'') || ' ' || COALESCE(question_ar,'') || ' ' || COALESCE(answer_en,'')`;
    const likeClause = likeTerms.length
      ? likeTerms.map((_, i) => `${likeCols} ILIKE '%' || $${i + likeBaseIndex} || '%'`).join(' OR ')
      : 'false';
    const scoreExprs = likeTerms.map((_, i) =>
      `CASE WHEN ${likeCols} ILIKE '%' || $${i + likeBaseIndex} || '%' THEN 1 ELSE 0 END`
    );
    const scoreSum = scoreExprs.length
      ? scoreExprs.join(' + ')
      : '0';
    const params = [terms, limit];
    let facultyFilter = '';
    if (facultyId != null) {
      params.push(Number(facultyId));
      facultyFilter = ` AND fq.faculty_id = $${params.length}`;
    }
    const r = await pool.query(
      `SELECT fq.question_en AS "questionEn",
              fq.question_ar AS "questionAr",
              fq.answer_en   AS "answerEn",
              fq.answer_ar   AS "answerAr",
              fq.normalized_intent AS "intent",
              fq.keywords,
              fp.official_name_en AS "facultyNameEn",
              fp.slug AS "facultySlug",
              (CASE WHEN fq.keywords && $1::text[] THEN 10 ELSE 0 END) + (${scoreSum}) AS _score
       FROM faculty_qa fq
       JOIN faculty_profiles fp ON fp.id = fq.faculty_id
       WHERE (fq.keywords && $1::text[] OR ${likeClause})${facultyFilter}
       ORDER BY _score DESC, fq.id ASC
       LIMIT $2`,
      [...params, ...likeTerms]
    );
    return r.rows;
  }

  async getStats() {
    const r = await pool.query(
      `SELECT students_count        AS "studentsCount",
              faculty_members_count  AS "facultyMembersCount",
              programs_count         AS "programsCount"
       FROM faculty_statistics
       WHERE faculty_id = 1`
    );
    return r.rows[0] ?? null;
  }

  async getAbetPrograms() {
    const r = await pool.query(
      `SELECT program_key  AS "programKey",
              name_en      AS "nameEn",
              name_ar      AS "nameAr",
              department_name AS "departmentName"
       FROM engineering_programs
       WHERE is_abet_accredited = true
       ORDER BY name_en ASC`
    );
    return r.rows;
  }
}
