import { pool } from '../db/pool.js';

export class NotificationsRepository {
  async listByUserId({ userId, unreadOnly = false, limit = 5 } = {}) {
    const r = await pool.query(
      `SELECT id, title, message, read, created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
         AND ($2::boolean = false OR read = false)
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [userId, unreadOnly, limit]
    );
    return r.rows;
  }

  async countByUserId({ userId, unreadOnly = false } = {}) {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM notifications
       WHERE user_id = $1
         AND ($2::boolean = false OR read = false)`,
      [userId, unreadOnly]
    );
    return r.rows[0]?.n ?? 0;
  }
}

