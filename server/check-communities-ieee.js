import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function main() {
  const ieee = await pool.query(
    "SELECT id, name, college_id FROM communities WHERE name = 'IEEE' ORDER BY id"
  );
  console.log('IEEE rows:', ieee.rows);

  const orphanEvents = await pool.query(
    `SELECT COUNT(1)::int AS c
     FROM events e
     LEFT JOIN communities c ON c.id = e.community_id
     WHERE e.community_id IS NOT NULL AND c.id IS NULL`
  );
  const orphanUsers = await pool.query(
    `SELECT COUNT(1)::int AS c
     FROM app_users u
     LEFT JOIN communities c ON c.id = u.community_id
     WHERE u.community_id IS NOT NULL AND c.id IS NULL`
  );
  console.log('Orphan community_id refs:', {
    events: orphanEvents.rows[0]?.c ?? 0,
    app_users: orphanUsers.rows[0]?.c ?? 0,
  });

  const dup = await pool.query(
    'SELECT name, COUNT(1)::int AS c FROM communities GROUP BY name HAVING COUNT(1) > 1 ORDER BY c DESC, name'
  );
  console.log('Duplicate community names:', dup.rows);

  const constraint = await pool.query(
    "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'communities'::regclass AND conname = 'communities_name_unique'"
  );
  console.log('communities_name_unique:', constraint.rows);

  const canonical = await pool.query(
    "SELECT MIN(id)::bigint AS id FROM communities WHERE name = 'IEEE'"
  );
  const canonicalId = canonical.rows[0]?.id;
  if (canonicalId != null) {
    const users = await pool.query(
      'SELECT COUNT(1)::int AS c FROM app_users WHERE community_id = $1',
      [canonicalId]
    );
    const events = await pool.query(
      'SELECT COUNT(1)::int AS c FROM events WHERE community_id = $1',
      [canonicalId]
    );
    console.log('Refs to canonical IEEE id:', {
      community_id: canonicalId,
      app_users: users.rows[0]?.c ?? 0,
      events: events.rows[0]?.c ?? 0,
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

