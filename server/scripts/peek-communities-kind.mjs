import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project',
});

const byKind = await pool.query(
  'SELECT kind, COUNT(*)::int AS n FROM communities GROUP BY kind ORDER BY kind'
);
const assoc = await pool.query(
  "SELECT id, name, kind FROM communities WHERE kind = 'association' ORDER BY id"
);
console.log('By kind:', byKind.rows);
console.log('Associations:', assoc.rows);
await pool.end();
