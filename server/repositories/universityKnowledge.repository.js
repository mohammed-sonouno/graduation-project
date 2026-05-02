import { pool } from '../db/pool.js';

export class UniversityKnowledgeRepository {
  async searchQA({ terms = [], limit = 3 } = {}) {
    if (!terms.length) return [];
    const likeTerms = terms.filter(t => t.length >= 3);
    const likeCols = `COALESCE(question_en,'') || ' ' || COALESCE(question_ar,'') || ' ' || COALESCE(answer_en,'')`;
    const likeClause = likeTerms.length
      ? likeTerms.map((_, i) => `${likeCols} ILIKE '%' || $${i + 3} || '%'`).join(' OR ')
      : 'false';
    const scoreExprs = likeTerms.map((_, i) =>
      `CASE WHEN ${likeCols} ILIKE '%' || $${i + 3} || '%' THEN 1 ELSE 0 END`
    );
    const scoreSum = scoreExprs.length
      ? scoreExprs.join(' + ')
      : '0';
    const r = await pool.query(
      `SELECT question_en AS "questionEn",
              question_ar AS "questionAr",
              answer_en   AS "answerEn",
              answer_ar   AS "answerAr",
              normalized_intent AS "intent",
              keywords,
              (CASE WHEN keywords && $1::text[] THEN 10 ELSE 0 END) + (${scoreSum}) AS _score
       FROM university_qa
       WHERE university_id = 1
         AND (keywords && $1::text[] OR ${likeClause})
       ORDER BY _score DESC, id ASC
       LIMIT $2`,
      [terms, limit, ...likeTerms]
    );
    return r.rows;
  }

  async getStats() {
    const r = await pool.query(
      `SELECT bachelor_programs_count AS "bachelorCount",
              master_programs_count   AS "masterCount",
              phd_programs_count      AS "phdCount",
              faculties_count         AS "facultiesCount",
              students_count          AS "studentsCount",
              campuses_count          AS "campusesCount",
              books_count             AS "booksCount",
              ebooks_count            AS "ebooksCount",
              ejournals_count         AS "ejournalsCount"
       FROM university_statistics
       WHERE university_id = 1`
    );
    return r.rows[0] ?? null;
  }

  async getTimeline({ limit = 14 } = {}) {
    const r = await pool.query(
      `SELECT year, title, description
       FROM university_timeline
       WHERE university_id = 1
       ORDER BY sort_order ASC
       LIMIT $1`,
      [limit]
    );
    return r.rows;
  }

  async getProfile() {
    const r = await pool.query(
      `SELECT name_en       AS "nameEn",
              name_ar       AS "nameAr",
              slug,
              overview_en   AS "overviewEn",
              overview_ar   AS "overviewAr",
              campuses_count AS "campusesCount",
              campuses_note  AS "campusesNote"
       FROM university_profiles
       WHERE slug = 'an-najah'`
    );
    return r.rows[0] ?? null;
  }
}
