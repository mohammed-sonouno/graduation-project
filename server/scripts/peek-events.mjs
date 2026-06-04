import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const events = await pool.query(
  `SELECT id, title, status, start_date, end_date, image, community_id, created_at
   FROM events ORDER BY created_at DESC`
);
console.log('events count:', events.rows.length);
console.log(JSON.stringify(events.rows, null, 2));

const notifs = await pool.query(
  `SELECT id, title, message, created_at FROM notifications
   WHERE message ILIKE '%event%' OR message ILIKE '%IEEE%' OR message ILIKE '%فعال%'
   ORDER BY created_at DESC LIMIT 60`
);
console.log('\nnotifications:', notifs.rows.length);
for (const r of notifs.rows) {
  console.log('-', r.created_at?.toISOString?.() || r.created_at, '|', r.message?.slice(0, 140));
}

await pool.end();
