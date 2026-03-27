import 'dotenv/config';
import pg from 'pg';

/**
 * Delete all reviews/ratings (event_reviews) for a single event.
 *
 * Usage:
 *   node server/delete-event-reviews.js --eventId ev-123
 *   node server/delete-event-reviews.js --title "test2"
 *
 * Notes:
 * - This does NOT delete the event itself.
 * - This does NOT delete registrations.
 */

const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--eventId') out.eventId = argv[i + 1];
    if (a === '--title') out.title = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const eventId = args.eventId ? String(args.eventId).trim() : '';
  const title = args.title ? String(args.title).trim() : '';

  if (!eventId && !title) {
    console.error('Missing args. Provide --eventId or --title.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let id = eventId;
    if (!id) {
      const r = await client.query(
        'SELECT id, title FROM events WHERE title = $1 ORDER BY created_at DESC LIMIT 1',
        [title]
      );
      if (r.rows.length === 0) {
        throw new Error(`No event found with title: ${title}`);
      }
      id = String(r.rows[0].id);
      console.log(`Resolved title "${title}" → eventId ${id}`);
    }

    const countBefore = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM event_reviews WHERE event_id = $1',
      [id]
    );
    console.log(`Reviews before delete: ${countBefore.rows[0]?.cnt ?? 0}`);

    const del = await client.query(
      'DELETE FROM event_reviews WHERE event_id = $1',
      [id]
    );
    console.log(`Deleted rows: ${del.rowCount ?? 0}`);

    const countAfter = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM event_reviews WHERE event_id = $1',
      [id]
    );
    console.log(`Reviews after delete: ${countAfter.rows[0]?.cnt ?? 0}`);

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

