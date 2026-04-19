import { pool } from '../db/pool.js';

export class CommunitiesRepository {
  async list({ limit = 10 } = {}) {
    const r = await pool.query(
      `SELECT c.id, c.name, c.college_id AS "collegeId", co.name AS "collegeName"
       FROM communities c
       JOIN colleges co ON co.id = c.college_id
       ORDER BY co.id ASC, c.name ASC
       LIMIT $1`,
      [limit]
    );
    return r.rows;
  }

  async searchByName({ q, limit = 10 } = {}) {
    const r = await pool.query(
      `SELECT c.id, c.name, c.college_id AS "collegeId", co.name AS "collegeName"
       FROM communities c
       JOIN colleges co ON co.id = c.college_id
       WHERE c.name ILIKE '%' || $1 || '%'
       ORDER BY c.name ASC
       LIMIT $2`,
      [q, limit]
    );
    return r.rows;
  }

  async countAll() {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM communities`);
    return r.rows[0]?.n ?? 0;
  }
}

