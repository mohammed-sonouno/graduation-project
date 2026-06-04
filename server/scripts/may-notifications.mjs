import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
  `SELECT message, created_at FROM notifications
   WHERE created_at >= '2026-05-01'
   ORDER BY created_at DESC`
);
for (const row of r.rows) {
  console.log(row.created_at.toISOString(), '|', row.message);
}
await pool.end();
