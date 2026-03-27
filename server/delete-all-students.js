/**
 * One-off script: delete all users with role 'student' from app_users.
 * DESTRUCTIVE: Related rows (event_registrations, student_profiles, notifications, etc.) are removed by DB CASCADE.
 * Use only in dev/test. Run from project root: node server/delete-all-students.js
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    const countResult = await client.query(
      "SELECT COUNT(*) AS count FROM app_users WHERE role = 'student'"
    );
    const count = parseInt(countResult.rows[0].count, 10);
    if (count === 0) {
      console.log('No student accounts found. Nothing to delete.');
      return;
    }
    console.log(`Found ${count} student account(s). Deleting...`);
    await client.query("DELETE FROM app_users WHERE role = 'student'");
    console.log(`Deleted ${count} student account(s).`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
