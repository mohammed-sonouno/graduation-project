import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

export class ConversationRepository {
  async getById(conversationId) {
    const r = await pool.query(
      `SELECT id, user_id AS "userId", title,
              context_major_id AS "contextMajorId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chat_conversations
       WHERE id = $1`,
      [conversationId]
    );
    return r.rows[0] ?? null;
  }

  async listByUserId(userId) {
    const r = await pool.query(
      `SELECT id, user_id AS "userId", title,
              context_major_id AS "contextMajorId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chat_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC, id DESC`,
      [userId]
    );
    return r.rows;
  }

  async create({ userId, title = null, contextMajorId = null }) {
    try {
      const r = await pool.query(
        `INSERT INTO chat_conversations (user_id, title, context_major_id)
         VALUES ($1, $2, $3)
         RETURNING id, user_id AS "userId", title,
                   context_major_id AS "contextMajorId",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [userId, title, contextMajorId || null]
      );
      return r.rows[0];
    } catch (e) {
      // 23503: foreign_key_violation (e.g. user doesn't exist in app_users)
      if (e?.code === '23503') {
        throw new AppError('User not found (app_users)', { statusCode: 404, code: 'USER_NOT_FOUND' });
      }
      throw e;
    }
  }

  async touch(conversationId) {
    await pool.query(
      `UPDATE chat_conversations
       SET updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );
  }

  async setContextMajor(conversationId, contextMajorId) {
    await pool.query(
      `UPDATE chat_conversations
       SET context_major_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [conversationId, contextMajorId || null]
    );
  }
}

