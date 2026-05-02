import { pool } from '../db/pool.js';

export class EventRegistrationsRepository {
  async listByUserId({ userId, limit = 10 } = {}) {
    const r = await pool.query(
      `SELECT er.id,
              er.event_id AS "eventId",
              er.created_at AS "createdAt",
              e.title AS "eventTitle",
              e.start_date AS "eventStartDate",
              e.location AS "eventLocation"
       FROM event_registrations er
       LEFT JOIN events e ON e.id = er.event_id
       WHERE er.user_id = $1
       ORDER BY er.created_at DESC, er.id DESC
       LIMIT $2`,
      [userId, limit]
    );
    return r.rows;
  }

  async countByUserId(userId) {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM event_registrations WHERE user_id = $1`, [userId]);
    return r.rows[0]?.n ?? 0;
  }
}

