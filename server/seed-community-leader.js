/**
 * One-off: ensure a Community Leader user exists (communityleader@najah.edu, password 123456, role community_leader).
 * Run: node server/seed-community-leader.js
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

async function seedCommunityLeader() {
  const email = 'communityleader@najah.edu';
  const password = '123456';
  const hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id FROM app_users WHERE email = $1', [email]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET password_hash = $1, role = 'community_leader' WHERE email = $2",
        [hash, email]
      );
      console.log('Community Leader user updated: communityleader@najah.edu, password 123456, role community_leader.');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'community_leader')",
        [email, hash]
      );
      console.log('Community Leader user created: communityleader@najah.edu, password 123456, role community_leader.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seedCommunityLeader().catch((e) => {
  console.error(e);
  process.exit(1);
});
