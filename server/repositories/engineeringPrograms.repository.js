import { pool } from '../db/pool.js';

// Reusable (final backend): read-only repository for engineering programs.
// No user data stored/used.

export class EngineeringProgramsRepository {
  /**
   * Slim row set for recommendation ranking (less I/O than listAll).
   * Same filters/order as listAll; omits descriptions, notes, keywords, etc.
   */
  async listForRecommendation({ facultySlug = 'an-najah-faculty-engineering' } = {}) {
    const r = await pool.query(
      `SELECT program_key AS "programKey",
              name_en AS "nameEn",
              name_ar AS "nameAr",
              stream_type AS "streamType",
              min_acceptance_average_min AS "minAvgMin",
              min_acceptance_average_max AS "minAvgMax",
              is_estimate AS "isEstimate",
              degree_type AS "degreeType",
              is_abet_accredited AS "isAbetAccredited",
              department_name AS "departmentName",
              keywords
       FROM engineering_programs
       WHERE faculty_slug = $1
       ORDER BY name_en ASC`,
      [facultySlug]
    );
    return r.rows;
  }

  async listAll({ facultySlug = 'an-najah-faculty-engineering' } = {}) {
    const r = await pool.query(
      `SELECT program_key AS "programKey",
              name_en AS "nameEn",
              name_ar AS "nameAr",
              description_en AS "descriptionEn",
              description_ar AS "descriptionAr",
              degree_type AS "degreeType",
              stream_type AS "streamType",
              min_acceptance_average_min AS "minAvgMin",
              min_acceptance_average_max AS "minAvgMax",
              is_estimate AS "isEstimate",
              difficulty_level AS "difficulty",
              estimated_competition_level AS "competition",
              general_notes AS "notes",
              is_abet_accredited AS "isAbetAccredited",
              department_name AS "departmentName",
              career_summary_en AS "careerSummaryEn",
              career_summary_ar AS "careerSummaryAr",
              keywords
       FROM engineering_programs
       WHERE faculty_slug = $1
       ORDER BY name_en ASC`,
      [facultySlug]
    );
    return r.rows;
  }

  async getByProgramKey(programKey) {
    const r = await pool.query(
      `SELECT program_key AS "programKey",
              name_en AS "nameEn",
              name_ar AS "nameAr",
              description_en AS "descriptionEn",
              description_ar AS "descriptionAr",
              degree_type AS "degreeType",
              stream_type AS "streamType",
              min_acceptance_average_min AS "minAvgMin",
              min_acceptance_average_max AS "minAvgMax",
              is_estimate AS "isEstimate",
              difficulty_level AS "difficulty",
              estimated_competition_level AS "competition",
              general_notes AS "notes",
              is_abet_accredited AS "isAbetAccredited",
              department_name AS "departmentName",
              career_summary_en AS "careerSummaryEn",
              career_summary_ar AS "careerSummaryAr",
              keywords
       FROM engineering_programs
       WHERE program_key = $1`,
      [programKey]
    );
    return r.rows[0] ?? null;
  }

  async searchByKeyword({ q, facultySlug = 'an-najah-faculty-engineering', limit = 10 } = {}) {
    const term = String(q || '').trim().toLowerCase();
    if (!term) return [];
    const r = await pool.query(
      `SELECT program_key AS "programKey",
              name_en AS "nameEn",
              name_ar AS "nameAr",
              stream_type AS "streamType",
              min_acceptance_average_min AS "minAvgMin",
              min_acceptance_average_max AS "minAvgMax",
              is_estimate AS "isEstimate"
       FROM engineering_programs
       WHERE faculty_slug = $1
         AND (
           $2 = ANY (keywords)
           OR COALESCE(name_en,'') ILIKE '%' || $2 || '%'
           OR COALESCE(name_ar,'') ILIKE '%' || $2 || '%'
         )
       ORDER BY name_en ASC
       LIMIT $3`,
      [facultySlug, term, limit]
    );
    return r.rows;
  }
}

