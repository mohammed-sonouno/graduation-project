import { Router } from 'express';
import {
  isAdminRole,
  isDeanRole,
  isCommunityLeaderRole,
  isSupervisorRole,
  FACULTY_ENGINEERING_CANONICAL,
} from '../../config/rules.js';

const communitiesHasCollegeIdByPool = new WeakMap();

async function communitiesHasCollegeIdColumn(pool) {
  if (communitiesHasCollegeIdByPool.has(pool)) return communitiesHasCollegeIdByPool.get(pool);
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'college_id'`
  );
  const v = r.rows.length > 0;
  communitiesHasCollegeIdByPool.set(pool, v);
  return v;
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export default function communitiesRouter(pool) {
  const router = Router();

  /** Display name: app_users has first_name/last_name (no single `name` column in many DBs). */
  const sqlUserDisplayName = (alias = 'u') =>
    `COALESCE(NULLIF(TRIM(${alias}.first_name || ' ' || COALESCE(${alias}.last_name, '')), ''), ${alias}.email)`;

  const sqlOwnerDisplayName = () =>
    `(SELECT COALESCE(NULLIF(TRIM(au.first_name || ' ' || COALESCE(au.last_name, '')), ''), au.email)
        FROM app_users au WHERE au.id = c.owner_id)`;

  // ─── Community Requests ────────────────────────────────────────────────────

  router.post('/community-requests', requireAuth, async (req, res) => {
    try {
      const { name, description, colleges, image_url } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0)
        return res.status(400).json({ error: 'Name is required' });
      if (name.length > 255)
        return res.status(400).json({ error: 'Name is too long' });

      const result = await pool.query(
        `INSERT INTO community_requests (requester_id, name, description, colleges, image_url, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, requester_id, name, description, colleges, image_url, status, created_at`,
        [
          req.user.id,
          name.trim(),
          description ? String(description).trim() : null,
          Array.isArray(colleges) ? colleges : [],
          image_url ? String(image_url).trim() : null,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST /community-requests error:', err);
      res.status(500).json({ error: 'Failed to create community request' });
    }
  });

  /** GET/POST for /api/community-requests/mine and /:id/dismiss are registered in server/index.js (so they are always matched). */

  router.get('/community-requests', requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const params = [];
      let where = '';
      if (status) { params.push(status); where = 'WHERE cr.status = $1'; }

      const result = await pool.query(
        `SELECT cr.id, cr.requester_id, cr.name, cr.description, cr.colleges,
                cr.image_url, cr.status, cr.reviewed_by, cr.reviewed_at, cr.created_at,
                u.email AS requester_email, ${sqlUserDisplayName('u')} AS requester_name
         FROM community_requests cr
         JOIN app_users u ON cr.requester_id = u.id
         ${where}
         ORDER BY cr.created_at DESC`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /community-requests error:', err);
      res.status(500).json({ error: 'Failed to load community requests' });
    }
  });

  router.patch('/community-requests/:id/review', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const requestId = Number(req.params.id);
      if (Number.isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' });

      const { status } = req.body;
      if (!['approved', 'rejected'].includes(status))
        return res.status(400).json({ error: 'Status must be approved or rejected' });

      await client.query('BEGIN');

      const reqRow = await client.query(
        'SELECT * FROM community_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      if (reqRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Community request not found' });
      }
      const cr = reqRow.rows[0];
      if (cr.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Request has already been reviewed' });
      }

      await client.query(
        'UPDATE community_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
        [status, req.user.id, requestId]
      );

      if (status === 'approved') {
        if (String(cr.name || '').trim().toLowerCase() === 'ieee') {
          const cols = Array.isArray(cr.colleges) ? cr.colleges : [];
          const engNorm = FACULTY_ENGINEERING_CANONICAL.toLowerCase();
          const ieeeOk =
            cols.length === 1 && cols.every((x) => String(x || '').trim().toLowerCase() === engNorm);
          if (!ieeeOk) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'Cannot approve: IEEE requests must specify Faculty of Engineering only.',
            });
          }
        }
        const commResult = await client.query(
          `INSERT INTO communities (request_id, owner_id, name, description, colleges, image_url, kind)
           VALUES ($1, $2, $3, $4, $5, $6, 'community') RETURNING id`,
          [cr.id, cr.requester_id, cr.name, cr.description, cr.colleges, cr.image_url]
        );
        await client.query(
          'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT (community_id, user_id) DO NOTHING',
          [commResult.rows[0].id, cr.requester_id]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('PATCH /community-requests/:id/review error:', err);
      res.status(500).json({ error: 'Failed to review community request' });
    } finally {
      client.release();
    }
  });

  // ─── Communities ───────────────────────────────────────────────────────────

  router.get('/communities', async (req, res) => {
    try {
      const page   = Math.max(1, Number(req.query.page)  || 1);
      const limit  = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
      const offset = (page - 1) * limit;
      const search  = req.query.search  ? String(req.query.search).trim()  : null;
      const college = req.query.college ? String(req.query.college).trim() : null;
      const kindFilter = req.query.kind && ['community', 'association'].includes(String(req.query.kind).trim())
        ? String(req.query.kind).trim() : null;

      const params = [];
      let where = 'WHERE 1=1';

      if (search) {
        params.push(`%${search}%`);
        where += ` AND (c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
      }
      if (college) {
        params.push(college);
        where += ` AND $${params.length} = ANY(c.colleges)`;
      }
      if (kindFilter) {
        params.push(kindFilter);
        where += ` AND c.kind = $${params.length}`;
      }

      const userId = req.user?.id || null;
      params.push(userId);
      const mp = params.length;
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT c.id, c.name, c.description, c.colleges, c.image_url, c.kind, c.chat_enabled,
                c.owner_id, c.created_at, ${sqlOwnerDisplayName()} AS owner_name,
                COUNT(DISTINCT cm.user_id)::int AS member_count,
                CASE
                  WHEN c.owner_id = $${mp} THEN 'owner'
                  WHEN EXISTS (SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $${mp}) THEN 'member'
                  WHEN EXISTS (SELECT 1 FROM join_requests WHERE community_id = c.id AND user_id = $${mp} AND status = 'pending') THEN 'pending'
                  ELSE 'none'
                END AS membership_status
         FROM communities c
         LEFT JOIN community_members cm ON cm.community_id = c.id
         ${where}
         GROUP BY c.id
         ORDER BY member_count DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /communities error:', err);
      res.status(500).json({ error: 'Failed to load communities' });
    }
  });

  /**
   * POST /api/communities — admin only.
   * - Legacy body { name, collegeId, leaderId } → old supervisor assignment flow (Manage Communities admin UI).
   * - Otherwise { name, description?, colleges?, image_url? } → direct user-created community (admin as owner).
   */
  router.post('/communities', requireAuth, requireAdmin, async (req, res) => {
    const body = req.body || {};
    const legacyLeader =
      body.leaderId != null && body.leaderId !== '' &&
      body.collegeId != null && body.collegeId !== '';

    try {
      if (legacyLeader) {
        const { name, collegeId, leaderId } = body;
        if (!name || collegeId == null) {
          return res.status(400).json({ error: 'name and collegeId are required' });
        }
        if (leaderId == null || leaderId === '') {
          return res.status(400).json({ error: 'leaderId is required. Each community must have a supervisor.' });
        }
        if (String(name).trim().toLowerCase() === 'ieee') {
          const engR = await pool.query(
            `SELECT id FROM colleges WHERE lower(trim(name)) = lower(trim($1)) ORDER BY id LIMIT 1`,
            [FACULTY_ENGINEERING_CANONICAL]
          );
          const engId = engR.rows[0]?.id;
          if (engId == null) {
            return res.status(500).json({ error: 'Faculty of Engineering is not configured in the database.' });
          }
          if (Number(collegeId) !== Number(engId)) {
            return res.status(403).json({
              error: 'IEEE must belong to Faculty of Engineering only.',
            });
          }
        }
        const leaderIdNum = Number(leaderId);
        if (Number.isNaN(leaderIdNum)) return res.status(400).json({ error: 'Invalid leaderId' });
        const userCheck = await pool.query('SELECT id, role FROM app_users WHERE id = $1', [leaderIdNum]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Leader user not found' });
        const role = userCheck.rows[0].role;
        if (role !== 'supervisor' && role !== 'community_leader') {
          return res.status(400).json({ error: 'Leader must have role supervisor or community_leader' });
        }
        const hasCollegeId = await communitiesHasCollegeIdColumn(pool);
        let createdRow;
        if (hasCollegeId) {
          const r = await pool.query(
            `INSERT INTO communities (name, college_id, kind) VALUES ($1, $2, 'association')
             RETURNING id, name, college_id AS "collegeId"`,
            [String(name).trim(), Number(collegeId)]
          );
          createdRow = r.rows[0];
        } else {
          const cn = await pool.query('SELECT name FROM colleges WHERE id = $1', [Number(collegeId)]);
          const collegeNameVal = cn.rows[0]?.name;
          if (!collegeNameVal) return res.status(400).json({ error: 'Invalid college' });
          const r = await pool.query(
            `INSERT INTO communities (name, colleges, owner_id, kind) VALUES ($1, $2::text[], $3, 'association')
             RETURNING id, name`,
            [String(name).trim(), [collegeNameVal], leaderIdNum]
          );
          createdRow = { ...r.rows[0], collegeId: Number(collegeId) };
        }
        const newId = createdRow.id;
        await pool.query(
          "UPDATE app_users SET community_id = NULL, role = 'student' WHERE community_id = $1 AND id != $2",
          [newId, leaderIdNum]
        );
        await pool.query('UPDATE app_users SET community_id = $1 WHERE id = $2', [newId, leaderIdNum]);
        return res.status(201).json(createdRow);
      }

      const { name, description, colleges, image_url } = body;
      if (!name || typeof name !== 'string' || !String(name).trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (String(name).trim().toLowerCase() === 'ieee') {
        const cols = Array.isArray(colleges) ? colleges : [];
        const engNorm = FACULTY_ENGINEERING_CANONICAL.toLowerCase();
        const ok =
          cols.length === 1 &&
          cols.every((x) => String(x || '').trim().toLowerCase() === engNorm);
        if (!ok) {
          return res.status(403).json({
            error: 'IEEE must list Faculty of Engineering only.',
          });
        }
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO communities (owner_id, name, description, colleges, image_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            req.user.id,
            String(name).trim(),
            description != null ? String(description).trim() : '',
            Array.isArray(colleges) ? colleges : [],
            image_url ? String(image_url).trim() : null,
          ]
        );
        const communityId = result.rows[0].id;
        await client.query(
          'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT (community_id, user_id) DO NOTHING',
          [communityId, req.user.id]
        );
        await client.query('COMMIT');
        return res.status(201).json({ id: communityId, success: true });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err?.code === '23503') return res.status(400).json({ error: 'Invalid college' });
      if (err?.code === '23505') {
        return res.status(409).json({ error: 'A community with this name already exists in this college' });
      }
      console.error('POST /communities error:', err);
      return res.status(500).json({ error: 'Failed to create community' });
    }
  });

  router.get('/communities/:id', async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community ID' });

      const userId = req.user?.id || null;
      const result = await pool.query(
        `SELECT c.id, c.name, c.description, c.colleges, c.image_url, c.kind, c.chat_enabled,
                c.owner_id, c.created_at, ${sqlOwnerDisplayName()} AS owner_name,
                COUNT(DISTINCT cm.user_id)::int AS member_count,
                CASE
                  WHEN c.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $2) THEN 'member'
                  WHEN EXISTS (SELECT 1 FROM join_requests WHERE community_id = c.id AND user_id = $2 AND status = 'pending') THEN 'pending'
                  ELSE 'none'
                END AS membership_status
         FROM communities c
         LEFT JOIN community_members cm ON cm.community_id = c.id
         WHERE c.id = $1
         GROUP BY c.id`,
        [communityId, userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('GET /communities/:id error:', err);
      res.status(500).json({ error: 'Failed to load community' });
    }
  });

  /** PATCH /api/communities/:id — owner (or admin): chat/description/image; admin/dean/leader: rename (same rules as legacy index). */
  router.patch('/communities/:id', requireAuth, async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community ID' });

      const hasCollegeId = await communitiesHasCollegeIdColumn(pool);
      const existing = await pool.query(
        hasCollegeId
          ? 'SELECT c.id, c.name, c.owner_id, c.college_id FROM communities c WHERE c.id = $1'
          : 'SELECT c.id, c.name, c.owner_id, c.colleges FROM communities c WHERE c.id = $1',
        [communityId]
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      const row = existing.rows[0];
      const body = req.body || {};

      const isAdmin = isAdminRole(req.user.role);
      const isDean = isDeanRole(req.user.role);
      const isLeader = isCommunityLeaderRole(req.user.role);
      const isOwner = Number(row.owner_id) === Number(req.user.id);

      const wantsProfile =
        body.chat_enabled !== undefined || body.description !== undefined || body.image_url !== undefined;
      if (wantsProfile && !isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the community owner or admin can change chat settings or branding' });
      }

      let mayChangeName = false;
      if (body.name !== undefined) {
        if (!body.name || !String(body.name).trim()) return res.status(400).json({ error: 'name is required when provided' });
        if (isAdmin) mayChangeName = true;
        else if (isDean) {
          if (req.user.college_id == null) {
            return res.status(403).json({ error: 'You can only edit communities of your college' });
          }
          if (hasCollegeId) {
            if (Number(row.college_id) !== Number(req.user.college_id)) {
              return res.status(403).json({ error: 'You can only edit communities of your college' });
            }
            mayChangeName = true;
          } else {
            const chk = await pool.query(
              `SELECT 1 FROM colleges WHERE id = $1 AND name = ANY (COALESCE((SELECT colleges FROM communities WHERE id = $2), '{}'))`,
              [req.user.college_id, communityId]
            );
            if (chk.rows.length === 0) {
              return res.status(403).json({ error: 'You can only edit communities of your college' });
            }
            mayChangeName = true;
          }
        } else if (isLeader) {
          if (req.user.community_id == null || Number(req.user.community_id) !== communityId) {
            return res.status(403).json({ error: 'You can only edit the community you lead' });
          }
          mayChangeName = true;
        } else if (isOwner) mayChangeName = true;
        else {
          return res.status(403).json({ error: 'Only admin, dean, community leader, or owner can change the name' });
        }
      }

      const nameParam =
        body.name !== undefined && mayChangeName ? String(body.name).trim() : null;
      const chatParam = body.chat_enabled !== undefined ? Boolean(body.chat_enabled) : null;
      const descParam = body.description !== undefined ? String(body.description) : null;
      const imgParam = body.image_url !== undefined ? String(body.image_url) : null;

      let kindParam = null;
      if (body.kind !== undefined) {
        if (!isAdmin) return res.status(403).json({ error: 'Only admin can change community kind' });
        const k = String(body.kind).trim();
        if (!['community', 'association'].includes(k)) {
          return res.status(400).json({ error: 'kind must be community or association' });
        }
        kindParam = k;
      }

      const idPlace = kindParam !== null ? 6 : 5;
      const result = await pool.query(
        `UPDATE communities
         SET name         = COALESCE($1, name),
             chat_enabled = COALESCE($2, chat_enabled),
             description  = COALESCE($3, description),
             image_url    = COALESCE($4, image_url)${kindParam !== null ? ', kind = $5' : ''},
             updated_at   = NOW()
         WHERE id = $${idPlace}
         RETURNING *`,
        kindParam !== null
          ? [nameParam, chatParam, descParam, imgParam, kindParam, communityId]
          : [nameParam, chatParam, descParam, imgParam, communityId]
      );
      const updated = result.rows[0];
      let collegeName;
      if (hasCollegeId && updated.college_id != null) {
        collegeName = (await pool.query('SELECT name FROM colleges WHERE id = $1', [updated.college_id])).rows[0]?.name;
      } else if (!hasCollegeId) {
        collegeName = (
          await pool.query(
            `SELECT string_agg(cl.name, ', ' ORDER BY cl.name) AS n FROM colleges cl
             WHERE cl.name = ANY (COALESCE((SELECT colleges FROM communities WHERE id = $1), '{}'))`,
            [communityId]
          )
        ).rows[0]?.n;
      }
      res.json({ ...updated, collegeId: updated.college_id, collegeName });
    } catch (err) {
      if (err?.code === '23505') return res.status(409).json({ error: 'A community with this name already exists in this college' });
      console.error('PATCH /communities/:id error:', err);
      res.status(500).json({ error: 'Failed to update community' });
    }
  });

  router.delete('/communities/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId))
        return res.status(400).json({ error: 'Invalid community ID' });

      const comm = await client.query(
        'SELECT owner_id FROM communities WHERE id = $1',
        [communityId]
      );
      if (comm.rows.length === 0)
        return res.status(404).json({ error: 'Community not found' });

      if (!isAdminRole(req.user.role) && Number(comm.rows[0].owner_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Only owner or admin can delete this community' });
      }

      await client.query('BEGIN');
      await client.query('UPDATE app_users SET community_id = NULL WHERE community_id = $1', [communityId]);
      await client.query('DELETE FROM community_messages WHERE community_id = $1', [communityId]);
      await client.query('DELETE FROM join_requests WHERE community_id = $1', [communityId]);
      await client.query('DELETE FROM community_members WHERE community_id = $1', [communityId]);
      await client.query('DELETE FROM communities WHERE id = $1', [communityId]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('DELETE /communities/:id error:', err);
      res.status(500).json({ error: 'Failed to delete community' });
    } finally {
      client.release();
    }
  });

  // ─── Members ───────────────────────────────────────────────────────────────

  router.get('/communities/:id/members', async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community ID' });

      const result = await pool.query(
        `SELECT u.id, ${sqlUserDisplayName('u')} AS "name", u.email, cm.joined_at,
                (c.owner_id = u.id) AS is_owner
         FROM community_members cm
         JOIN app_users u ON u.id = cm.user_id
         JOIN communities c ON c.id = cm.community_id
         WHERE cm.community_id = $1
         ORDER BY (c.owner_id = u.id) DESC, cm.joined_at ASC`,
        [communityId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /communities/:id/members error:', err);
      res.status(500).json({ error: 'Failed to load members' });
    }
  });

  router.delete('/communities/:id/members/:userId', requireAuth, async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId      = Number(req.params.userId);
      if (Number.isNaN(communityId) || Number.isNaN(userId))
        return res.status(400).json({ error: 'Invalid ID' });

      const comm = await pool.query('SELECT owner_id FROM communities WHERE id = $1', [communityId]);
      if (comm.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      if (comm.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Only the owner can remove members' });
      if (userId === req.user.id)
        return res.status(400).json({ error: 'You cannot remove yourself' });

      const del = await pool.query(
        'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 RETURNING id',
        [communityId, userId]
      );
      if (del.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /communities/:id/members/:userId error:', err);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  // ─── Join Requests ─────────────────────────────────────────────────────────

  router.post('/communities/:id/join-requests', requireAuth, async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community ID' });

      if (isAdminRole(req.user.role)) {
        return res.status(400).json({ error: 'Admin does not need to join communities' });
      }

      const comm = await pool.query('SELECT id FROM communities WHERE id = $1', [communityId]);
      if (comm.rows.length === 0) return res.status(404).json({ error: 'Community not found' });

      const already = await pool.query(
        'SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2',
        [communityId, req.user.id]
      );
      if (already.rows.length > 0) return res.status(400).json({ error: 'Already a member' });

      // College restriction — staff bypass
      const staffRoles = ['admin', 'dean', 'supervisor'];
      if (!staffRoles.includes(req.user.role)) {
        const commRow = await pool.query(
          'SELECT colleges, owner_id FROM communities WHERE id = $1',
          [communityId]
        );
        const communityColleges = commRow.rows[0]?.colleges || [];

        if (communityColleges.length > 0) {
          const userRow = await pool.query(
            'SELECT college FROM app_users WHERE id = $1',
            [req.user.id]
          );
          const userCollege = userRow.rows[0]?.college || '';
          const allowed = communityColleges.some(
            (c) => c.toLowerCase().trim() === userCollege.toLowerCase().trim()
          );
          if (!allowed) {
            const list = communityColleges.join(' and ');
            return res.status(403).json({
              error: `This community is only for students in ${list}.`,
            });
          }
        }
      }

      const result = await pool.query(
        `INSERT INTO join_requests (community_id, user_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (community_id, user_id) DO UPDATE SET
           status = 'pending',
           reviewed_at = NULL
         WHERE join_requests.status = 'rejected'
         RETURNING id, status, created_at`,
        [communityId, req.user.id]
      );
      if (!result.rows.length) return res.status(409).json({ error: 'Join request already pending' });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST /communities/:id/join-requests error:', err);
      res.status(500).json({ error: 'Failed to create join request' });
    }
  });

  router.get('/communities/:id/join-requests', requireAuth, async (req, res) => {
    try {
      const communityId = Number(req.params.id);
      if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community ID' });

      const comm = await pool.query('SELECT owner_id FROM communities WHERE id = $1', [communityId]);
      if (comm.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      if (comm.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Only the owner can view join requests' });

      const { status } = req.query;
      const params = [communityId];
      let extra = '';
      if (status) { params.push(status); extra = `AND jr.status = $${params.length}`; }

      const result = await pool.query(
        `SELECT jr.id, jr.user_id, jr.status, jr.created_at, jr.reviewed_at,
                ${sqlUserDisplayName('u')} AS "name", u.email
         FROM join_requests jr
         JOIN app_users u ON u.id = jr.user_id
         WHERE jr.community_id = $1 ${extra}
         ORDER BY jr.created_at ASC`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /communities/:id/join-requests error:', err);
      res.status(500).json({ error: 'Failed to load join requests' });
    }
  });

  router.patch('/communities/:id/join-requests/:requestId', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const communityId = Number(req.params.id);
      const requestId   = Number(req.params.requestId);
      if (Number.isNaN(communityId) || Number.isNaN(requestId))
        return res.status(400).json({ error: 'Invalid ID' });

      const { status } = req.body;
      if (!['approved', 'rejected'].includes(status))
        return res.status(400).json({ error: 'Status must be approved or rejected' });

      const comm = await pool.query('SELECT owner_id FROM communities WHERE id = $1', [communityId]);
      if (comm.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
      if (comm.rows[0].owner_id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Only the owner can review join requests' });

      await client.query('BEGIN');

      const jr = await client.query(
        'SELECT * FROM join_requests WHERE id = $1 AND community_id = $2 FOR UPDATE',
        [requestId, communityId]
      );
      if (jr.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Join request not found' });
      }
      if (jr.rows[0].status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Request already reviewed' });
      }

      await client.query(
        'UPDATE join_requests SET status = $1, reviewed_at = NOW() WHERE id = $2',
        [status, requestId]
      );

      if (status === 'approved') {
        await client.query(
          'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT (community_id, user_id) DO NOTHING',
          [communityId, jr.rows[0].user_id]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('PATCH join-requests/:requestId error:', err);
      res.status(500).json({ error: 'Failed to review join request' });
    } finally {
      client.release();
    }
  });

  return router;
}