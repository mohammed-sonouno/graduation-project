import { pool } from '../db/pool.js';

export class MajorChatContextRepository {
  async getByMajorId(majorId) {
    if (majorId == null || String(majorId).trim() === '') return null;
    const r = await pool.query(
      `SELECT major_id AS "majorId",
              category,
              greeting_en AS "greetingEn",
              greeting_ar AS "greetingAr",
              suggested_questions_en AS "suggestedQuestionsEn",
              suggested_questions_ar AS "suggestedQuestionsAr",
              facts_en AS "factsEn",
              facts_ar AS "factsAr",
              engineering_program_key AS "engineeringProgramKey"
       FROM major_chat_context
       WHERE major_id = $1`,
      [String(majorId).trim()]
    );
    return r.rows[0] ?? null;
  }
}
