/**
 * Seed the system with a single association (IEEE), required users, and admin.
 * Run after migrations: node server/seed-ieee.js
 *
 * Creates/updates (emails stored lowercase so login works):
 * - admin@najah.edu (admin, password 123)
 * - ieee@najah.edu (community_leader, IEEE association)
 * - ieee.sup@najah.edu (supervisor, IEEE association)
 * - eng.dean@najah.edu (dean, Engineering & IT college)
 * - One community: IEEE (College of Engineering & IT)
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const PASSWORD_123 = '123';

async function seedIeee() {
  const client = await pool.connect();
  try {
    // Allow both leader and supervisor to have the same community_id
    await client.query('DROP INDEX IF EXISTS idx_app_users_community_unique');

    const passwordHash = await bcrypt.hash(PASSWORD_123, 10);

    // 1) Admin: ensure exists, password 123 (store lowercase so login lookup finds it)
    const adminEmail = 'admin@najah.edu';
    const adminRow = await client.query('SELECT id FROM app_users WHERE email = $1', [adminEmail]);
    if (adminRow.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET password_hash = $1, role = 'admin' WHERE email = $2",
        [passwordHash, adminEmail]
      );
      console.log('Admin updated: admin@najah.edu, password 123');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'admin')",
        [adminEmail, passwordHash]
      );
      console.log('Admin created: admin@najah.edu, password 123');
    }

    // 2) College 1 = Engineering & IT (from 003_colleges_majors)
    const col = await client.query('SELECT id FROM colleges WHERE id = 1');
    if (col.rows.length === 0) {
      await client.query("INSERT INTO colleges (id, name) VALUES (1, 'Engineering & IT') ON CONFLICT (id) DO NOTHING");
    }
    const collegeId = 1;

    // 3) Unlink all users from communities, then delete all communities
    await client.query('UPDATE app_users SET community_id = NULL WHERE community_id IS NOT NULL');
    await client.query('UPDATE app_users SET college_id = NULL WHERE role = $1', ['dean']);
    await client.query('DELETE FROM communities');

    // 4) Insert single community: IEEE
    const ins = await client.query(
      'INSERT INTO communities (name, college_id) VALUES ($1, $2) RETURNING id',
      ['IEEE', collegeId]
    );
    const ieeeId = ins.rows[0].id;
    console.log('Community created: IEEE (id ' + ieeeId + ')');

    // 5) IEEE leader (store lowercase so /api/auth/login finds it)
    const leaderEmail = 'ieee@najah.edu';
    let r = await client.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1)', [leaderEmail]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET email = $1, password_hash = $2, role = 'community_leader', community_id = $3 WHERE id = $4",
        [leaderEmail, passwordHash, ieeeId, r.rows[0].id]
      );
      console.log('IEEE leader updated: ieee@najah.edu, password 123');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role, community_id) VALUES ($1, $2, 'community_leader', $3)",
        [leaderEmail, passwordHash, ieeeId]
      );
      console.log('IEEE leader created: ieee@najah.edu, password 123');
    }

    // 6) IEEE supervisor (store lowercase so login finds it)
    const supEmail = 'ieee.sup@najah.edu';
    r = await client.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1)', [supEmail]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET email = $1, password_hash = $2, role = 'supervisor', community_id = $3 WHERE id = $4",
        [supEmail, passwordHash, ieeeId, r.rows[0].id]
      );
      console.log('IEEE supervisor updated: ieee.sup@najah.edu, password 123');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role, community_id) VALUES ($1, $2, 'supervisor', $3)",
        [supEmail, passwordHash, ieeeId]
      );
      console.log('IEEE supervisor created: ieee.sup@najah.edu, password 123');
    }

    // 7) Engineering dean (store lowercase so login finds it)
    const deanEmail = 'eng.dean@najah.edu';
    r = await client.query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1)', [deanEmail]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET email = $1, password_hash = $2, role = 'dean', college_id = $3 WHERE id = $4",
        [deanEmail, passwordHash, collegeId, r.rows[0].id]
      );
      console.log('Engineering dean updated: eng.dean@najah.edu, password 123');
    } else {
      await client.query(
        "INSERT INTO app_users (email, password_hash, role, college_id) VALUES ($1, $2, 'dean', $3)",
        [deanEmail, passwordHash, collegeId]
      );
      console.log('Engineering dean created: eng.dean@najah.edu, password 123');
    }

    // 8) Link existing events to IEEE (they were set to null when communities were deleted)
    const up = await client.query('UPDATE events SET community_id = $1 WHERE community_id IS NULL RETURNING id', [ieeeId]);
    if (up.rowCount > 0) {
      console.log('Linked ' + up.rowCount + ' event(s) to IEEE');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seedIeee().catch((e) => {
  console.error(e);
  process.exit(1);
});
