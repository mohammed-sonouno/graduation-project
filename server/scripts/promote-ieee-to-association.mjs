/**
 * Mark IEEE-named communities as associations (event organizers / staff assignment).
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project',
});

const r = await pool.query(
  `UPDATE communities SET kind = 'association'
   WHERE lower(trim(name)) LIKE '%ieee%'
   RETURNING id, name, kind`
);
console.log('Promoted rows:', r.rowCount);
if (r.rows.length) console.log(r.rows);
await pool.end();
