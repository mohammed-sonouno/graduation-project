import { pool } from '../db/pool.js';

export class MessageRepository {
  async listByConversationId(conversationId) {
    const r = await pool.query(
      `SELECT id,
              conversation_id AS "conversationId",
              sender,
              content,
              created_at AS "createdAt"
       FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY id ASC`,
      [conversationId]
    );
    return r.rows;
  }

  async create({ conversationId, sender, content }) {
    const r = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender, content)
       VALUES ($1, $2, $3)
       RETURNING id,
                 conversation_id AS "conversationId",
                 sender,
                 content,
                 created_at AS "createdAt"`,
      [conversationId, sender, content]
    );
    return r.rows[0];
  }
}

