/**
 * Current user's community creation request cards (pending / rejected) + dismiss.
 * Shared by GET /api/community-requests/mine and GET /api/communities?includeMyRequestCards=1
 */

export function mapCommunityRequestRow(row) {
  return {
    is_community_request: true,
    request_id: row.id,
    request_status: row.status,
    name: row.name,
    description: row.description,
    colleges: row.colleges,
    image_url: row.image_url,
    chat_enabled: false,
    member_count: 0,
    owner_id: null,
    owner_name: null,
    created_at: row.created_at,
    id: null,
    membership_status: row.status === 'pending' ? 'request_pending' : 'request_rejected',
  };
}

/**
 * @returns {Promise<object[]>} DB rows
 */
export async function fetchMineRequestRows(pool, userId, search, college) {
  const params = [];
  let where = `WHERE cr.requester_id = $1
    AND cr.status IN ('pending', 'rejected')
    AND COALESCE(cr.dismissed_by_requester, false) = false`;
  params.push(userId);
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (cr.name ILIKE $${params.length} OR (cr.description IS NOT NULL AND cr.description ILIKE $${params.length}))`;
  }
  if (college) {
    params.push(college);
    where += ` AND $${params.length} = ANY(cr.colleges)`;
  }
  const result = await pool.query(
    `SELECT cr.id, cr.name, cr.description, cr.colleges, cr.image_url, cr.status, cr.created_at
     FROM community_requests cr
     ${where}
     ORDER BY cr.created_at DESC`,
    params
  );
  return result.rows;
}

export function createGetMineHandler(pool) {
  return async (req, res) => {
    try {
      const userId = req.user.id;
      const search = req.query.search ? String(req.query.search).trim() : null;
      const college = req.query.college ? String(req.query.college).trim() : null;
      const rows = await fetchMineRequestRows(pool, userId, search, college);
      res.json(rows.map(mapCommunityRequestRow));
    } catch (err) {
      console.error('GET /community-requests/mine error:', err);
      if (err.message && /dismissed_by_requester|column.*does not exist/i.test(String(err.message))) {
        return res.status(500).json({
          error: 'Database migration required: run 040_community_request_dismissed.sql (add dismissed_by_requester).',
        });
      }
      res.status(500).json({ error: 'Failed to load your community requests' });
    }
  };
}

export function createPostDismissHandler(pool) {
  return async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      if (Number.isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' });
      const r = await pool.query(
        `UPDATE community_requests
         SET dismissed_by_requester = true, updated_at = NOW()
         WHERE id = $1 AND requester_id = $2
           AND status IN ('pending', 'rejected')
         RETURNING id`,
        [requestId, req.user.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found or not eligible to dismiss' });
      res.json({ success: true });
    } catch (err) {
      console.error('POST /community-requests/:id/dismiss error:', err);
      if (err.message && /dismissed_by_requester|column.*does not exist/i.test(String(err.message))) {
        return res.status(500).json({
          error: 'Database migration required: run 040_community_request_dismissed.sql (add dismissed_by_requester).',
        });
      }
      res.status(500).json({ error: 'Failed to update request' });
    }
  };
}
