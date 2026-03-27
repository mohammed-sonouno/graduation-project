/**
 * Verify that all DB tables and required columns exist.
 * Usage: node server/check-db.js   or  npm run check:db
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const REQUIRED_TABLES = [
  'app_users',
  'colleges',
  'majors',
  'communities',
  'events',
  'event_registrations',
  'student_profiles',
  'notifications',
  'login_codes',
];

const REQUIRED_COLUMNS = {
  app_users: [
    'id', 'email', 'password_hash', 'role', 'created_at',
    'first_name', 'middle_name', 'last_name', 'student_number', 'college', 'major', 'phone',
    'must_change_password', 'must_complete_profile', 'college_id', 'community_id',
  ],
  colleges: ['id', 'name'],
  majors: ['id', 'name', 'college_id'],
  communities: ['id', 'name', 'college_id'],
  events: [
    'id', 'title', 'description', 'category', 'image', 'club_name', 'location',
    'start_date', 'start_time', 'end_date', 'end_time', 'available_seats', 'price', 'price_member',
    'featured', 'status', 'feedback', 'approval_step', 'custom_sections',
    'created_by', 'created_at', 'updated_at',
  ],
  event_registrations: [
    'id', 'user_id', 'event_id', 'student_id', 'college', 'major',
    'association_member', 'name', 'email', 'created_at',
  ],
  student_profiles: [
    'user_id', 'college', 'major', 'gpa', 'credits_earned', 'credits_total', 'picture',
    'created_at', 'updated_at',
  ],
  notifications: ['id', 'user_id', 'title', 'message', 'read', 'created_at'],
  login_codes: ['id', 'email', 'code', 'expires_at', 'created_at'],
};

async function getExistingTables(client) {
  const r = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  return r.rows.map((row) => row.table_name);
}

async function getColumnsForTable(client, tableName) {
  const r = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return r.rows.map((row) => row.column_name);
}

async function run() {
  const client = await pool.connect();
  let failed = false;
  try {
    const existingTables = await getExistingTables(client);
    const missingTables = REQUIRED_TABLES.filter((t) => !existingTables.includes(t));
    if (missingTables.length > 0) {
      console.error('Missing tables:', missingTables.join(', '));
      failed = true;
    }
    for (const table of REQUIRED_TABLES) {
      if (!existingTables.includes(table)) continue;
      const columns = await getColumnsForTable(client, table);
      const required = REQUIRED_COLUMNS[table] || [];
      const missingCols = required.filter((c) => !columns.includes(c));
      if (missingCols.length > 0) {
        console.error(`Table "${table}" missing columns:`, missingCols.join(', '));
        failed = true;
      }
    }
    if (!failed) {
      console.log('DB check OK: all required tables and columns exist.');
    }
  } catch (err) {
    console.error('DB check failed:', err.message);
    failed = true;
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(failed ? 1 : 0);
}

run();
