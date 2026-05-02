import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function main() {
  const r = await pool.query(
    "SELECT id, email, role, community_id FROM app_users WHERE role IN ('community_leader', 'supervisor') ORDER BY id"
  );
  console.log(r.rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

