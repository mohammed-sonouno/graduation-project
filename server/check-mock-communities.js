import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const MOCK_NAMES = [
  'Economics Forum',
  'Business & Entrepreneurship Club',
  'IEEE Student Branch',
  'Software Engineering Club',
  'Law Society',
  'Medical Students Society',
];

async function main() {
  const r = await pool.query(
    'SELECT id, name, college_id FROM communities WHERE name = ANY($1::text[]) ORDER BY name, id',
    [MOCK_NAMES]
  );
  console.log('Mock community rows still present:', r.rows);

  const counts = await pool.query(
    `SELECT
      (SELECT COUNT(1)::int FROM communities) AS communities_total,
      (SELECT COUNT(1)::int FROM app_users WHERE community_id IS NOT NULL) AS users_with_community,
      (SELECT COUNT(1)::int FROM events WHERE community_id IS NOT NULL) AS events_with_community`
  );
  console.log('Counts:', counts.rows[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

