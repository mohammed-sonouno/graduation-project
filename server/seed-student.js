/**
 * One-off: ensure a Student user exists (student@najah.edu, password 123456, role student).
 * Run: node server/seed-student.js
 * Note: New registrations still get role 'user' by default; both 'user' and 'student' are treated as Student in the UI.
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

async function seedStudent() {
  const email = 'student@najah.edu';
  const password = '123456';
  const hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id FROM app_users WHERE email = $1', [email]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET password_hash = $1, role = 'student' WHERE email = $2",
        [hash, email]
      );
      console.log('Student user updated: student@najah.edu, password 123456, role student.');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'student')",
        [email, hash]
      );
      console.log('Student user created: student@najah.edu, password 123456, role student.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seedStudent().catch((e) => {
  console.error(e);
  process.exit(1);
});
