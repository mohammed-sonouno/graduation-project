/**
 * Run all DB migrations in order. Usage: node server/run-migrations.js
 */
import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const migrations = [
  '002_app_users.sql',
  '003_student_fields.sql',
  '003_colleges_majors.sql',
  '004_rename_role_user_to_student.sql',
  '004_events.sql',
  '005_event_registrations.sql',
  '005_must_complete_profile.sql',
  '006_student_profiles.sql',
  '007_notifications.sql',
  '008_seed_events.sql',
  '010_module_data.sql',
  '011_communities_and_role_assignments.sql',
  '012_ensure_app_users_full_schema.sql',
  '013_events_community_college.sql',
  '014_backfill_event_community.sql',
  '016_db_checkup_improvements.sql',
  '017_drop_chatbot.sql',
  '018_login_codes.sql',
  '019_password_hash_nullable.sql',
  '020_constraints_checks.sql',
  '021_pending_registrations.sql',
  '022_event_registrations_status.sql',
  '023_event_audience_colleges_majors.sql',
  '024_event_registrations_payment.sql',
];

async function run() {
  const client = await pool.connect();
  const base = join(__dirname, '..', 'db', 'migrations');
  for (const name of migrations) {
    try {
      const sql = await readFile(join(base, name), 'utf8');
      await client.query(sql);
      console.log('OK:', name);
    } catch (err) {
      console.error('FAIL:', name, err.message);
      process.exitCode = 1;
    }
  }
  client.release();
  await pool.end();
}

run();
