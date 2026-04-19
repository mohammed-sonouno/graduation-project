import { pool } from '../db/pool.js';

// SECURITY: strict allowlist repository.
// This repository is the ONLY place the chatbot is allowed to read user fields from `app_users`.
// It returns ONLY:
// - id
// - name (derived from first/middle/last)
export class UserSafeRepository {
  async getSafeById(userId) {
    const r = await pool.query(
      `SELECT id,
              first_name AS "firstName",
              middle_name AS "middleName",
              last_name AS "lastName"
       FROM app_users
       WHERE id = $1`,
      [userId]
    );

    const row = r.rows[0];
    if (!row) return null;

    const name =
      [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim() || 'there';

    return { id: row.id, name };
  }

  /** Optional academic hints from student_profiles (GPA / declared major text). */
  async getAcademicHints(userId) {
    const r = await pool.query(
      `SELECT gpa, major AS "profileMajor"
       FROM student_profiles
       WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row) return { gpa: null, profileMajor: null };
    const gpa = row.gpa != null && row.gpa !== '' ? Number(row.gpa) : null;
    return {
      gpa: Number.isFinite(gpa) ? gpa : null,
      profileMajor: row.profileMajor ? String(row.profileMajor).trim() : null
    };
  }
}

