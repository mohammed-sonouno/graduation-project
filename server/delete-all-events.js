/**
 * Delete all events and event-dependent data from the dev database.
 * Order: event_reviews -> event_registrations -> events (respects FKs).
 * Usage: node server/delete-all-events.js
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Delete in order: children first (event_reviews, event_registrations), then events
    let reviewsDeleted = 0;
    try {
      const r = await client.query('DELETE FROM event_reviews');
      reviewsDeleted = r.rowCount ?? 0;
    } catch (e) {
      if (e.code !== '42P01') throw e; // ignore if table doesn't exist
    }
    const reg = await client.query('DELETE FROM event_registrations');
    const ev = await client.query('DELETE FROM events');

    console.log('Deleted:', reviewsDeleted, 'event_reviews,', reg.rowCount, 'event_registrations,', ev.rowCount, 'events.');

    // Verify no event rows remain
    const count = await client.query('SELECT COUNT(*) AS n FROM events');
    const n = parseInt(count.rows[0]?.n ?? '0', 10);
    if (n !== 0) {
      console.error('Verification failed: events table still has', n, 'rows.');
      process.exit(1);
    }
    console.log('Verified: events table is empty.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
