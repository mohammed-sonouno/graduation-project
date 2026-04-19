import { pool } from '../db/pool.js';

export class EventsRepository {
  async countAll() {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM events`);
    return r.rows[0]?.n ?? 0;
  }

  async countByStatus(status) {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM events WHERE status = $1`, [status]);
    return r.rows[0]?.n ?? 0;
  }

  async listUpcoming({ limit = 5 } = {}) {
    const r = await pool.query(
      `SELECT id, title, start_date AS "startDate", start_time AS "startTime", location, status
       FROM events
       WHERE start_date IS NOT NULL
       ORDER BY start_date ASC NULLS LAST, id ASC
       LIMIT $1`,
      [limit]
    );
    return r.rows;
  }

  async findById(eventId) {
    const r = await pool.query(
      `SELECT id, title, description, category, club_name AS "clubName", location,
              start_date AS "startDate", start_time AS "startTime",
              end_date AS "endDate", end_time AS "endTime",
              available_seats AS "availableSeats", price, price_member AS "priceMember",
              featured, status
       FROM events
       WHERE id = $1`,
      [eventId]
    );
    return r.rows[0] ?? null;
  }

  async searchByTitle({ q, limit = 5 } = {}) {
    const r = await pool.query(
      `SELECT id, title, start_date AS "startDate", location, status
       FROM events
       WHERE title ILIKE '%' || $1 || '%'
       ORDER BY start_date DESC NULLS LAST, id DESC
       LIMIT $2`,
      [q, limit]
    );
    return r.rows;
  }
}

