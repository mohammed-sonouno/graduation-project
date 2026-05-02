/**
 * One-off: keep only IEEE-named rows as kind=association; rest → community.
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const sql = `
UPDATE communities SET kind = 'community'
WHERE kind = 'association'
  AND lower(trim(name)) NOT LIKE '%ieee%'
RETURNING id, name
`;

const r = await pool.query(sql);
console.log('Updated rows:', r.rowCount);
if (r.rows.length) console.log(r.rows.map((x) => `${x.id}: ${x.name}`).join('\n'));
await pool.end();
