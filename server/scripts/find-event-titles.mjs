import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const notifs = await pool.query(
  `SELECT message, created_at FROM notifications
   WHERE message ~ '"[^"]+"'
   ORDER BY created_at DESC`
);
const titles = new Set();
for (const r of notifs.rows) {
  const m = r.message.match(/"([^"]+)"/g);
  if (m) m.forEach((q) => titles.add(q));
}
console.log('quoted in notifications:', [...titles].sort().join('\n'));

const tables = await pool.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name ILIKE '%event%'`
);
console.log('\nevent tables:', tables.rows.map((r) => r.table_name).join(', '));

for (const table of ['event_registrations', 'event_reviews', 'event_approval_log']) {
  try {
    const c = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    console.log(table, 'rows', c.rows[0].n);
  } catch {
    /* skip */
  }
}

const regs = await pool.query(
  `SELECT DISTINCT e.id, e.title, e.status, e.start_date
   FROM event_registrations er
   JOIN events e ON e.id = er.event_id
   ORDER BY e.title`
).catch(() => ({ rows: [] }));
console.log('\nregistrations by event:', regs.rows);

await pool.end();
