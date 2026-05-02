import { Router } from 'express';

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireMember(pool) {
  return async (req, res, next) => {
    try {
      // Admin bypasses member check
      if (req.user?.role === 'admin') return next();

      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId))
        return res.status(400).json({ error: 'Invalid community ID' });

      const result = await pool.query(
        'SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1',
        [communityId, req.user.id]
      );
      if (result.rows.length === 0)
        return res.status(403).json({ error: 'You are not a member of this community' });

      next();
    } catch (err) {
      console.error('requireMember error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  };
}

export default function communityChatRouter(pool) {
  const router = Router({ mergeParams: true });

  // GET /api/communities/:id/messages
  router.get('/', requireAuth, requireMember(pool), async (req, res) => {
    try {
      const communityId = Number(req.params.id);

      const commRow = await pool.query(
        'SELECT chat_enabled, owner_id FROM communities WHERE id = $1',
        [communityId]
      );
      if (commRow.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      const grow = commRow.rows[0];
      if (!grow?.chat_enabled && Number(grow.owner_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Chat is disabled for this community' });
      }

      const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const beforeRaw = req.query.before != null ? String(req.query.before).trim() : '';
      const before = beforeRaw ? new Date(beforeRaw) : null;
      const beforeOk = before && !Number.isNaN(before.getTime());

      const params = [communityId];
      let extra = '';
      if (beforeOk) { params.push(before); extra = `AND cm.created_at < $${params.length}`; }
      params.push(limit);

      const result = await pool.query(
        `SELECT cm.id, cm.content, cm.created_at, cm.is_deleted,
                cm.sender_id,
                COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), u.email) AS sender_name
         FROM community_messages cm
         JOIN app_users u ON u.id = cm.sender_id
         WHERE cm.community_id = $1 ${extra}
         ORDER BY cm.created_at DESC
         LIMIT $${params.length}`,
        params
      );

      const rowsAsc = [...result.rows].reverse();
      const messages = rowsAsc.map((m) =>
        m.is_deleted ? { ...m, content: null, sender_name: null } : m
      );

      const oldest = rowsAsc.length ? rowsAsc[0].created_at : null;
      res.json({
        messages,
        next_cursor: rowsAsc.length === limit && oldest
          ? (oldest instanceof Date ? oldest.toISOString() : new Date(oldest).toISOString())
          : null,
      });
    } catch (err) {
      console.error('GET messages error:', err);
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  // POST /api/communities/:id/messages
  router.post('/', requireAuth, requireMember(pool), async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      const { content } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0)
        return res.status(400).json({ error: 'Content is required' });
      if (content.length > 2000)
        return res.status(400).json({ error: 'Content too long (max 2000 characters)' });

      const commRow = await pool.query(
        'SELECT chat_enabled, owner_id FROM communities WHERE id = $1',
        [communityId]
      );
      if (commRow.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      const crow = commRow.rows[0];
      if (!crow?.chat_enabled && Number(crow.owner_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'الدردشة معطّلة، فقط المالك يمكنه الإرسال' });
      }

      const result = await pool.query(
        `INSERT INTO community_messages (community_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, content, created_at`,
        [communityId, req.user.id, content.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST messages error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // DELETE /api/communities/:id/messages/:messageId
  router.delete('/:messageId', requireAuth, requireMember(pool), async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      const messageId   = Number(req.params.messageId);
      if (Number.isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });

      const msg = await pool.query(
        'SELECT sender_id FROM community_messages WHERE id = $1 AND community_id = $2',
        [messageId, communityId]
      );
      if (msg.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

      const comm = await pool.query(
        'SELECT owner_id FROM communities WHERE id = $1',
        [communityId]
      );
      if (comm.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      const isOwner  = comm.rows[0]?.owner_id === req.user.id;
      const isSender = msg.rows[0].sender_id   === req.user.id;

      if (!isOwner && !isSender)
        return res.status(403).json({ error: 'Only the owner or sender can delete messages' });

      await pool.query(
        'UPDATE community_messages SET is_deleted = true WHERE id = $1',
        [messageId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE message error:', err);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  });

  return router;
}