/**
 * Verify community_* table columns (read-only). Apply schema with: npm run migrate
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const TABLES = [
  'community_requests',
  'communities',
  'community_members',
  'join_requests',
  'community_messages',
];

const sql = `
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = ANY($1::text[])
ORDER BY table_name, ordinal_position;
`;

const r = await pool.query(sql, [TABLES]);
const by = {};
for (const row of r.rows) {
  if (!by[row.table_name]) by[row.table_name] = [];
  by[row.table_name].push(`${row.column_name}:${row.data_type}`);
}
for (const t of TABLES) {
  console.log(t, by[t] ? `${by[t].length} cols` : 'MISSING', by[t]?.join(' | ') || '');
}
await pool.end();
