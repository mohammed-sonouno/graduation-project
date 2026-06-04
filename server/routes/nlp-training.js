import { Router } from 'express';
import { pool } from '../db/pool.js';
import { isAdminRole } from '../../config/rules.js';

const router = Router();
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8001';
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'];

let reviewSchema = null;
let communitySchema = null;
let hasTrainingRunsTable = false;

async function loadCommunitySchema() {
  if (communitySchema) return communitySchema;
  const colRes = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'communities'
       AND column_name IN ('college_id', 'colleges')`
  );
  const cols = new Set(colRes.rows.map((r) => r.column_name));
  communitySchema = {
    hasCollegeId: cols.has('college_id'),
    hasCollegesArray: cols.has('colleges'),
  };
  return communitySchema;
}

async function loadReviewSchema() {
  if (reviewSchema) return reviewSchema;

  await loadCommunitySchema();

  const colRes = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_reviews'
       AND column_name IN (
         'used_for_training', 'training_corrected_at', 'nlp_flag_for_review',
         'nlp_confidence', 'user_id', 'override_sentiment'
       )`
  );
  const cols = new Set(colRes.rows.map((r) => r.column_name));

  const tableRes = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'nlp_training_runs' LIMIT 1`
  );
  hasTrainingRunsTable = tableRes.rows.length > 0;

  reviewSchema = {
    usedForTraining: cols.has('used_for_training'),
    trainingCorrectedAt: cols.has('training_corrected_at'),
    nlpFlagForReview: cols.has('nlp_flag_for_review'),
    nlpConfidence: cols.has('nlp_confidence'),
    userId: cols.has('user_id'),
  };

  if (!reviewSchema.usedForTraining) {
    console.warn(
      '[NLP] event_reviews.used_for_training missing — run: npm run migrate (053_nlp_training_feedback.sql)'
    );
  }

  return reviewSchema;
}

function sqlCommunityCollegeJoin() {
  const cs = communitySchema || { hasCollegeId: true, hasCollegesArray: false };
  if (cs.hasCollegeId && cs.hasCollegesArray) {
    return `
LEFT JOIN LATERAL (
  SELECT COALESCE(
    (SELECT id FROM colleges WHERE id = c.college_id LIMIT 1),
    (
      SELECT cl.id FROM colleges cl
      WHERE cl.name = ANY (COALESCE(c.colleges, '{}'::text[]))
      ORDER BY cl.id ASC
      LIMIT 1
    )
  ) AS resolved_college_id
) _nlp_cc ON true
LEFT JOIN colleges col ON col.id = _nlp_cc.resolved_college_id`;
  }
  if (cs.hasCollegeId) {
    return 'LEFT JOIN colleges col ON col.id = c.college_id';
  }
  return `LEFT JOIN LATERAL (
    SELECT MIN(cl.id) AS id FROM colleges cl
    WHERE cl.name = ANY (COALESCE(c.colleges, '{}'::text[]))
  ) _nlp_cc ON true
LEFT JOIN colleges col ON col.id = _nlp_cc.id`;
}

function sqlCommunityMatchesCollegeParam(paramRef) {
  const cs = communitySchema || { hasCollegeId: true, hasCollegesArray: false };
  if (cs.hasCollegeId && cs.hasCollegesArray) {
    return `(
      c.college_id = ${paramRef}::int
      OR EXISTS (
        SELECT 1 FROM colleges col_match
        WHERE col_match.id = ${paramRef}::int
          AND col_match.name = ANY (COALESCE(c.colleges, '{}'::text[]))
      )
    )`;
  }
  if (cs.hasCollegeId) {
    return `c.college_id = ${paramRef}::int`;
  }
  return `EXISTS (
    SELECT 1 FROM colleges col_match
    WHERE col_match.id = ${paramRef}::int
      AND col_match.name = ANY (COALESCE(c.colleges, '{}'::text[]))
  )`;
}

function buildReviewSelect(schema) {
  const parts = [
    'r.id',
    'r.event_id',
    'r.comment',
    'r.comment AS comment_text',
    'r.rating',
    'r.sentiment',
    'r.override_sentiment',
    schema.nlpConfidence ? 'r.nlp_confidence' : 'NULL::double precision AS nlp_confidence',
    schema.nlpFlagForReview ? 'r.nlp_flag_for_review' : 'FALSE AS nlp_flag_for_review',
    schema.usedForTraining ? 'r.used_for_training' : 'FALSE AS used_for_training',
    schema.trainingCorrectedAt ? 'r.training_corrected_at' : 'NULL::timestamptz AS training_corrected_at',
    'r.created_at',
    'e.title AS event_title',
  ];

  if (schema.userId) {
    parts.push(
      `NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS student_name`,
      'u.college AS college_name',
      'u.major AS major_name'
    );
  } else {
    parts.push('NULL::text AS student_name', 'NULL::text AS college_name', 'NULL::text AS major_name');
  }

  const userJoin = schema.userId ? 'LEFT JOIN app_users u ON u.id = r.user_id' : '';

  return `
    SELECT ${parts.join(',\n    ')}
    FROM event_reviews r
    LEFT JOIN events e ON e.id = r.event_id
    ${userJoin}
  `;
}

function mapReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    event_id: row.event_id,
    comment: row.comment,
    comment_text: row.comment_text ?? row.comment ?? '',
    rating: row.rating,
    sentiment: row.sentiment,
    override_sentiment: row.override_sentiment,
    nlp_confidence: row.nlp_confidence,
    nlp_flag_for_review: Boolean(row.nlp_flag_for_review),
    used_for_training: Boolean(row.used_for_training),
    training_corrected_at: row.training_corrected_at,
    created_at: row.created_at,
    event_title: row.event_title,
    student_name: row.student_name,
    college_name: row.college_name,
    major_name: row.major_name,
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    review_count: row.review_count,
    flagged_count: row.flagged_count,
    pending_corrections: row.pending_corrections,
    community_id: row.community_id,
    community_name: row.community_name,
    college_id: row.college_id,
    college_name: row.college_name,
  };
}

function flaggedCountExpr(schema) {
  if (schema.nlpFlagForReview) {
    return `COUNT(r.id) FILTER (WHERE r.nlp_flag_for_review = TRUE AND r.override_sentiment IS NULL)::int`;
  }
  return '0::int';
}

function pendingCorrectionsExpr(schema) {
  if (schema.usedForTraining) {
    return `COUNT(r.id) FILTER (WHERE r.override_sentiment IS NOT NULL AND r.used_for_training = FALSE)::int`;
  }
  return `COUNT(r.id) FILTER (WHERE r.override_sentiment IS NOT NULL)::int`;
}

function pendingTrainingExpr(schema) {
  if (schema.usedForTraining) {
    return `COUNT(*) FILTER (WHERE override_sentiment IS NOT NULL AND used_for_training = FALSE)::int`;
  }
  return `COUNT(*) FILTER (WHERE override_sentiment IS NOT NULL)::int`;
}

function flaggedUnreviewedExpr(schema) {
  if (schema.nlpFlagForReview) {
    return `COUNT(*) FILTER (WHERE nlp_flag_for_review = TRUE AND override_sentiment IS NULL)::int`;
  }
  return '0::int';
}

function buildOverrideUpdate(schema, sentiment, idParamIndex) {
  const sets = [`override_sentiment = $1`, 'updated_at = NOW()'];
  if (schema.usedForTraining) sets.push('used_for_training = FALSE');
  if (schema.trainingCorrectedAt) sets.push('training_corrected_at = NOW()');
  return `UPDATE event_reviews SET ${sets.join(', ')} WHERE id = $${idParamIndex}`;
}

router.use(async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!isAdminRole(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  try {
    await loadReviewSchema();
    next();
  } catch (err) {
    console.error('[NLP] schema load failed', err);
    return res.status(500).json({ error: 'Failed to load NLP schema' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total_reviews,
        COUNT(*) FILTER (WHERE override_sentiment IS NOT NULL)::int AS total_corrections,
        ${pendingTrainingExpr(schema)} AS pending_training,
        ${flaggedUnreviewedExpr(schema)} AS flagged_unreviewed
      FROM event_reviews
    `);

    let lastRun = null;
    if (hasTrainingRunsTable) {
      const { rows: runs } = await pool.query(
        `SELECT id, started_at, completed_at, status, samples_used
         FROM nlp_training_runs ORDER BY started_at DESC LIMIT 1`
      );
      lastRun = runs[0] || null;
    }

    const row = rows[0] || {};
    return res.json({
      total_reviews: row.total_reviews ?? 0,
      total_corrections: row.total_corrections ?? 0,
      pending_training: row.pending_training ?? 0,
      totalPending: row.pending_training ?? 0,
      flagged_unreviewed: row.flagged_unreviewed ?? 0,
      last_run: lastRun,
      schema_ready: schema.usedForTraining,
    });
  } catch (err) {
    console.error('[NLP /stats]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    await loadCommunitySchema();

    const search = req.query.search ? String(req.query.search).trim() : '';
    const collegeIdRaw = req.query.college_id;
    const communityIdRaw = req.query.community_id;

    const collegeId =
      collegeIdRaw != null && String(collegeIdRaw).trim() !== ''
        ? parseInt(String(collegeIdRaw), 10)
        : null;
    const communityId =
      communityIdRaw != null && String(communityIdRaw).trim() !== ''
        ? String(communityIdRaw).trim()
        : null;

    const params = [];
    const conds = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conds.push(`(
        LOWER(e.title) LIKE LOWER($${idx})
        OR LOWER(COALESCE(e.description, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(e.category, '')) LIKE LOWER($${idx})
        OR LOWER(COALESCE(e.club_name, '')) LIKE LOWER($${idx})
      )`);
    }

    if (collegeId != null && !Number.isNaN(collegeId)) {
      params.push(collegeId);
      conds.push(sqlCommunityMatchesCollegeParam(`$${params.length}`));
    }

    if (communityId) {
      params.push(communityId);
      conds.push(`e.community_id = $${params.length}`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const flaggedExpr = flaggedCountExpr(schema);
    const pendingExpr = pendingCorrectionsExpr(schema);
    const orderFlagged = schema.nlpFlagForReview
      ? `COUNT(r.id) FILTER (WHERE r.nlp_flag_for_review = TRUE AND r.override_sentiment IS NULL) DESC,`
      : '';
    const collegeJoin = sqlCommunityCollegeJoin();

    const { rows } = await pool.query(
      `
      SELECT
        e.id,
        e.title,
        e.start_date,
        e.community_id,
        c.name AS community_name,
        col.id AS college_id,
        col.name AS college_name,
        COUNT(r.id)::int AS review_count,
        ${flaggedExpr} AS flagged_count,
        ${pendingExpr} AS pending_corrections
      FROM events e
      INNER JOIN event_reviews r ON r.event_id = e.id
      LEFT JOIN communities c ON c.id = e.community_id
      ${collegeJoin}
      ${where}
      GROUP BY e.id, e.title, e.start_date, e.community_id, c.name, col.id, col.name
      HAVING COUNT(r.id) > 0
      ORDER BY ${orderFlagged} COUNT(r.id) DESC, e.start_date DESC NULLS LAST
      LIMIT 200
    `,
      params
    );

    return res.json({ events: rows.map(mapEventRow) });
  } catch (err) {
    console.error('[NLP /events]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    const filter = String(req.query.filter || 'all');
    const eventId = req.query.event_id ? String(req.query.event_id).trim() : null;

    const params = [];
    const conditions = [];

    if (eventId) {
      params.push(eventId);
      conditions.push(`r.event_id = $${params.length}`);
    }

    const filterSqlMap = {
      flagged: schema.nlpFlagForReview
        ? 'r.nlp_flag_for_review = TRUE AND r.override_sentiment IS NULL'
        : 'FALSE',
      corrected: 'r.override_sentiment IS NOT NULL',
      pending: schema.usedForTraining
        ? 'r.override_sentiment IS NOT NULL AND r.used_for_training = FALSE'
        : 'r.override_sentiment IS NOT NULL',
    };
    if (filterSqlMap[filter] && filter !== 'flagged') conditions.push(filterSqlMap[filter]);
    if (filter === 'flagged' && schema.nlpFlagForReview) conditions.push(filterSqlMap.flagged);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const reviewSelect = buildReviewSelect(schema);
    const orderFlag = schema.nlpFlagForReview ? 'r.nlp_flag_for_review DESC NULLS LAST,' : '';

    const { rows } = await pool.query(
      `
      ${reviewSelect}
      ${where}
      ORDER BY ${orderFlag} (r.override_sentiment IS NULL)::int DESC, r.created_at DESC
      LIMIT 300
    `,
      params
    );

    return res.json({ reviews: rows.map(mapReviewRow) });
  } catch (err) {
    console.error('[NLP /reviews]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/override', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    const reviewId = req.body?.reviewId ?? req.body?.review_id;
    const sentiment = String(req.body?.sentiment || '').trim().toLowerCase();

    if (!reviewId) {
      return res.status(400).json({ error: 'reviewId is required' });
    }
    if (!VALID_SENTIMENTS.includes(sentiment)) {
      return res.status(400).json({ error: `sentiment must be one of: ${VALID_SENTIMENTS.join(', ')}` });
    }

    const { rowCount } = await pool.query(buildOverrideUpdate(schema, sentiment, 2), [
      sentiment,
      String(reviewId),
    ]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const reviewSelect = buildReviewSelect(schema);
    const { rows } = await pool.query(`${reviewSelect} WHERE r.id = $1`, [String(reviewId)]);
    return res.json({ success: true, updatedReview: mapReviewRow(rows[0]) });
  } catch (err) {
    console.error('[NLP POST /override]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/reviews/:id', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    const sentiment = String(req.body?.sentiment || '').trim().toLowerCase();
    if (!VALID_SENTIMENTS.includes(sentiment)) {
      return res.status(400).json({ error: `sentiment must be one of: ${VALID_SENTIMENTS.join(', ')}` });
    }

    const { rowCount } = await pool.query(buildOverrideUpdate(schema, sentiment, 2), [
      sentiment,
      req.params.id,
    ]);

    if (rowCount === 0) return res.status(404).json({ error: 'Review not found' });

    const reviewSelect = buildReviewSelect(schema);
    const { rows } = await pool.query(`${reviewSelect} WHERE r.id = $1`, [req.params.id]);
    return res.json({ success: true, updatedReview: mapReviewRow(rows[0]) });
  } catch (err) {
    console.error('[NLP PATCH review]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/train', async (req, res) => {
  try {
    const schema = await loadReviewSchema();
    if (!hasTrainingRunsTable) {
      return res.status(503).json({
        error: 'NLP training table missing. Run: npm run migrate',
      });
    }

    const pendingWhere = schema.usedForTraining ? 'AND used_for_training = FALSE' : '';

    const { rows: samples } = await pool.query(`
      SELECT comment, COALESCE(override_sentiment, sentiment) AS label
      FROM event_reviews
      WHERE override_sentiment IS NOT NULL
        AND comment IS NOT NULL
        AND TRIM(comment) <> ''
        ${pendingWhere}
    `);

    if (samples.length < 1) {
      return res.status(400).json({
        error: 'Need at least 1 corrected review with a comment to start training.',
        pending: samples.length,
      });
    }

    const {
      rows: [run],
    } = await pool.query(
      `INSERT INTO nlp_training_runs (triggered_by, status, samples_used)
       VALUES ($1, 'running', $2) RETURNING id`,
      [req.user.id, samples.length]
    );

    let nlpResult;
    try {
      const nlpRes = await fetch(`${NLP_SERVICE_URL}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!nlpRes.ok) {
        const errText = await nlpRes.text().catch(() => '');
        await pool.query(
          `UPDATE nlp_training_runs SET status='failed', completed_at=NOW(), notes=$1 WHERE id=$2`,
          [errText.slice(0, 500), run.id]
        );
        return res.status(502).json({ error: 'NLP service returned an error', details: errText.slice(0, 300) });
      }

      nlpResult = await nlpRes.json();
    } catch (fetchErr) {
      await pool.query(
        `UPDATE nlp_training_runs SET status='failed', completed_at=NOW(), notes=$1 WHERE id=$2`,
        [String(fetchErr?.message || fetchErr).slice(0, 500), run.id]
      );
      return res.status(502).json({ error: `NLP service unreachable: ${fetchErr?.message || fetchErr}` });
    }

    if (schema.usedForTraining) {
      await pool.query(`
        UPDATE event_reviews
        SET used_for_training = TRUE, updated_at = NOW()
        WHERE override_sentiment IS NOT NULL
          AND comment IS NOT NULL AND TRIM(comment) <> ''
          AND used_for_training = FALSE
      `);
    }

    await pool.query(
      `UPDATE nlp_training_runs
       SET status = 'completed',
           completed_at = NOW(),
           accuracy_before = $1,
           accuracy_after = $2,
           model_version_after = $3
       WHERE id = $4`,
      [nlpResult.accuracy_before ?? null, nlpResult.accuracy_after ?? null, nlpResult.model_version ?? null, run.id]
    );

    return res.json({ ok: true, run_id: run.id, ...nlpResult });
  } catch (err) {
    console.error('[NLP /train]', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    if (!hasTrainingRunsTable) {
      return res.json({ runs: [] });
    }
    const { rows } = await pool.query(`
      SELECT r.id, r.started_at, r.completed_at, r.status,
             r.samples_used, r.accuracy_before, r.accuracy_after
      FROM nlp_training_runs r
      ORDER BY r.started_at DESC
      LIMIT 10
    `);
    return res.json({ runs: rows });
  } catch (err) {
    console.error('[NLP /runs]', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
