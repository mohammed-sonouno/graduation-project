import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const EMAIL = 'S12219287@stu.najah.edu';

async function main() {
  const emailNorm = EMAIL.trim().toLowerCase();

  const before = await pool.query(
    'SELECT id, email, role, community_id, college_id FROM app_users WHERE LOWER(email) = $1 LIMIT 1',
    [emailNorm]
  );
  console.log('Before:', before.rows[0] || null);

  const upd = await pool.query(
    "UPDATE app_users SET role = 'student' WHERE LOWER(email) = $1 RETURNING id, email, role",
    [emailNorm]
  );
  if (upd.rows.length === 0) {
    console.error('User not found for email:', emailNorm);
    process.exitCode = 1;
    return;
  }

  console.log('Updated:', upd.rows[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

