import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;
// Same default as server/index.js (override with DATABASE_URL in .env)
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

/**
 * Ensures admin user exists: admin@najah.edu, password 123456, role admin.
 * Run: node server/seed-admin.js
 */
const ADMIN_EMAIL = 'admin@najah.edu';
const ADMIN_PASSWORD = '123456';

async function seedAdmin() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id, email FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [ADMIN_EMAIL]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET email = $1, password_hash = $2, role = 'admin' WHERE LOWER(email) = LOWER($1)",
        [ADMIN_EMAIL, hash]
      );
      console.log('Admin updated: admin@najah.edu, password 123456');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'admin')",
        [ADMIN_EMAIL, hash]
      );
      console.log('Admin created: admin@najah.edu, password 123456');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
