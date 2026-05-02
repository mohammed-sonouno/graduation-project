/**
 * Delete communities whose name or description matches test-like data.
 * Matches: substring "test" (case-insensitive) in name or description.
 * Usage: node server/delete-test-communities.js
 * Uses DATABASE_URL from env (same as other server scripts).
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function main() {
  const list = await pool.query(
    `SELECT id, name FROM communities
     WHERE name ILIKE '%test%' OR COALESCE(description, '') ILIKE '%test%'`
  );
  if (list.rows.length === 0) {
    console.log('No communities matched (name or description ILIKE %test%).');
    return;
  }
  console.log('Will delete:', list.rows);
  const ids = list.rows.map((r) => r.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE app_users SET community_id = NULL WHERE community_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM community_messages WHERE community_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM join_requests WHERE community_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM community_members WHERE community_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM communities WHERE id = ANY($1::int[])', [ids]);
    await client.query('COMMIT');
    console.log('Deleted', ids.length, 'communities.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
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
