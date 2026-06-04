/**
 * Remove wrongly restored test IEEE events and restore real IEEE events
 * from db/ieee-production-events.json (posters in server/uploads).
 *
 * Run: node server/scripts/fix-ieee-events.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productionPath = path.join(__dirname, '..', '..', 'db', 'ieee-production-events.json');
const exportPath = path.join(__dirname, '..', '..', 'db-export', 'events.json');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const INSERT_SQL = `
  INSERT INTO events (
    id, title, description, category, image, club_name, location,
    start_date, start_time, end_date, end_time, available_seats, price, price_member,
    featured, status, feedback, approval_step, custom_sections, community_id,
    for_all_colleges, target_college_ids, target_all_majors, target_major_ids,
    created_by, created_at, updated_at,
    supervisor_approved, dean_approved, admin_approved,
    supervisor_approved_at, dean_approved_at, admin_approved_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
    $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    image = EXCLUDED.image,
    club_name = EXCLUDED.club_name,
    location = EXCLUDED.location,
    start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time,
    end_date = EXCLUDED.end_date,
    end_time = EXCLUDED.end_time,
    available_seats = EXCLUDED.available_seats,
    price = EXCLUDED.price,
    price_member = EXCLUDED.price_member,
    featured = EXCLUDED.featured,
    status = EXCLUDED.status,
    approval_step = EXCLUDED.approval_step,
    custom_sections = EXCLUDED.custom_sections,
    community_id = EXCLUDED.community_id,
    for_all_colleges = EXCLUDED.for_all_colleges,
    target_college_ids = EXCLUDED.target_college_ids,
    target_all_majors = EXCLUDED.target_all_majors,
    target_major_ids = EXCLUDED.target_major_ids,
    updated_at = NOW(),
    supervisor_approved = EXCLUDED.supervisor_approved,
    dean_approved = EXCLUDED.dean_approved,
    admin_approved = EXCLUDED.admin_approved,
    supervisor_approved_at = EXCLUDED.supervisor_approved_at,
    dean_approved_at = EXCLUDED.dean_approved_at,
    admin_approved_at = EXCLUDED.admin_approved_at
`;

function rowValues(e, ieeeCommunityId, engId, itId) {
  const now = new Date();
  const approvedAt = now.toISOString();
  let targetCollegeIds = e.target_college_ids;
  if (e.id === 'ev-1779532648066' && engId && itId) {
    targetCollegeIds = [engId, itId];
  } else if (e.id === 'ev-1779533516257' && engId) {
    targetCollegeIds = [engId];
  } else if (!Array.isArray(targetCollegeIds)) {
    targetCollegeIds = [];
  }

  return [
    e.id,
    e.title,
    e.description,
    e.category || 'Event',
    e.image || 'event1.jpg',
    e.club_name || 'IEEE',
    e.location,
    e.start_date ? String(e.start_date).slice(0, 10) : null,
    e.start_time || null,
    e.end_date ? String(e.end_date).slice(0, 10) : null,
    e.end_time || null,
    e.available_seats ?? 0,
    e.price ?? 0,
    e.price_member ?? null,
    Boolean(e.featured),
    e.status,
    e.feedback ?? null,
    e.approval_step ?? 3,
    JSON.stringify(e.custom_sections || []),
    ieeeCommunityId,
    e.for_all_colleges !== false,
    JSON.stringify(targetCollegeIds),
    e.target_all_majors !== false,
    JSON.stringify(e.target_major_ids || []),
    e.created_by ?? 4,
    e.created_at ? new Date(e.created_at) : now,
    now,
    Boolean(e.supervisor_approved),
    Boolean(e.dean_approved),
    Boolean(e.admin_approved),
    e.supervisor_approved ? approvedAt : null,
    e.dean_approved ? approvedAt : null,
    e.admin_approved ? approvedAt : null,
  ];
}

async function main() {
  const ieeeRes = await pool.query(
    `SELECT id FROM communities WHERE lower(trim(name)) = 'ieee' ORDER BY id LIMIT 1`
  );
  const ieeeCommunityId = ieeeRes.rows[0]?.id;
  if (!ieeeCommunityId) {
    console.error('IEEE community not found.');
    process.exit(1);
  }

  const engRes = await pool.query(
    `SELECT id FROM colleges WHERE lower(trim(name)) = lower(trim('Faculty of Engineering')) ORDER BY id LIMIT 1`
  );
  const itRes = await pool.query(
    `SELECT id FROM colleges WHERE lower(trim(name)) = lower(trim('Faculty of Information Technology & Artificial Intelligence')) ORDER BY id LIMIT 1`
  );
  const engId = engRes.rows[0]?.id;
  const itId = itRes.rows[0]?.id;

  const idsToRemove = new Set();
  if (fs.existsSync(exportPath)) {
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    for (const e of exported) {
      if (String(e.club_name || '').trim().toLowerCase() === 'ieee') idsToRemove.add(e.id);
    }
  }
  const current = await pool.query(
    `SELECT id, title FROM events WHERE community_id = $1 OR lower(trim(club_name)) = 'ieee'`,
    [ieeeCommunityId]
  );
  for (const row of current.rows) idsToRemove.add(row.id);

  const production = JSON.parse(fs.readFileSync(productionPath, 'utf8'));
  for (const e of production) idsToRemove.delete(e.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (idsToRemove.size > 0) {
      const removed = await client.query(
        `DELETE FROM events WHERE id = ANY($1::text[]) RETURNING id, title`,
        [[...idsToRemove]]
      );
      console.log(`Removed ${removed.rowCount} event(s):`);
      removed.rows.forEach((r) => console.log('  -', r.id, r.title));
    }

    for (const e of production) {
      await client.query(INSERT_SQL, rowValues(e, ieeeCommunityId, engId, itId));
      console.log('Restored:', e.id, '|', e.title, '|', e.start_date);
    }

    await client.query('COMMIT');
    const count = await pool.query(
      `SELECT id, title, start_date::date AS start_date, status FROM events WHERE community_id = $1 ORDER BY start_date`,
      [ieeeCommunityId]
    );
    console.log(`\nIEEE events now (${count.rows.length}):`);
    count.rows.forEach((r) => console.log(' ', r.id, r.title, r.start_date, r.status));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
