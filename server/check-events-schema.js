/**
 * Inspect actual columns of the events table. Usage: node server/check-events-schema.js
 * Compare output with INSERT column list in server/index.js (POST /api/events).
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const INSERT_COLUMNS = [
  'id', 'title', 'description', 'category', 'image', 'club_name', 'location',
  'start_date', 'start_time', 'end_date', 'end_time', 'available_seats', 'price', 'price_member',
  'featured', 'status', 'feedback', 'approval_step', 'custom_sections', 'community_id',
  'for_all_colleges', 'target_college_ids', 'target_all_majors', 'target_major_ids',
  'created_by', 'updated_at'
];

async function main() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events'
       ORDER BY ordinal_position`
    );
    const actual = r.rows.map((row) => row.column_name);
    console.log('Actual events table columns (' + actual.length + '):');
    r.rows.forEach((row, i) => console.log(`  ${i + 1}. ${row.column_name} (${row.data_type})`));
    console.log('');
    console.log('INSERT expects these 26 columns:', INSERT_COLUMNS.join(', '));
    const missing = INSERT_COLUMNS.filter((c) => !actual.includes(c));
    const extra = actual.filter((c) => !INSERT_COLUMNS.includes(c));
    if (missing.length) console.log('MISSING in table (add via migration):', missing.join(', '));
    if (extra.length) console.log('Extra in table (not in INSERT):', extra.join(', '));
    if (missing.length === 0 && actual.length >= 26) console.log('Schema matches INSERT.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
