/**
 * Seed static event reviews so the analytics dashboard has data.
 * Run: node server/seed-event-reviews.js
 * Uses same DB connection as server; safe to run multiple times (inserts only).
 */
import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const STATIC_REVIEWS = [
  { rating: 5, comment: 'One of the best events I have attended. The variety and quality of discussions were outstanding.', sentiment: 'positive' },
  { rating: 5, comment: 'Great opportunity to network and learn. The workshops were particularly helpful.', sentiment: 'positive' },
  { rating: 5, comment: 'Very well organized. The speakers were approachable and gave valuable feedback.', sentiment: 'positive' },
  { rating: 5, comment: 'Excellent speakers and very insightful sessions. Catering was great.', sentiment: 'positive' },
  { rating: 4, comment: 'Loved the diversity. Parking was a bit of a challenge but overall a very positive experience.', sentiment: 'positive' },
  { rating: 4, comment: 'محتوى مفيد وتنظيم جيد. استفدت من المحاضرات.', sentiment: 'positive' },
  { rating: 4, comment: 'Good content and venue. Would like to see more tech companies next year.', sentiment: 'positive' },
  { rating: 3, comment: 'Okay event. Some sessions ran late and the hall was crowded.', sentiment: 'neutral' },
  { rating: 3, comment: 'متوسط. التنظيم مقبول لكن الصوت في القاعة يحتاج تحسين.', sentiment: 'neutral' },
  { rating: 2, comment: 'Long lines at registration and the main hall was too small.', sentiment: 'negative' },
  { rating: 5, comment: 'Outstanding organization and timing. Will definitely come again.', sentiment: 'positive' },
  { rating: 4, comment: 'Great value. Speakers were engaging and topics were relevant.', sentiment: 'positive' },
];

async function seedEventReviews() {
  const client = await pool.connect();
  try {
    const eventsResult = await client.query(
      `SELECT id FROM events WHERE status = 'approved' ORDER BY created_at DESC LIMIT 10`
    );
    const eventIds = eventsResult.rows.map((r) => r.id);
    if (eventIds.length === 0) {
      console.log('No approved events found. Create and approve some events first, then run this script again.');
      return;
    }
    const countResult = await client.query(
      `SELECT event_id, COUNT(*) AS c FROM event_reviews WHERE event_id = ANY($1::varchar[]) GROUP BY event_id`,
      [eventIds]
    );
    const hasReviews = new Set((countResult.rows || []).map((r) => r.event_id));
    const toSeed = eventIds.filter((id) => !hasReviews.has(id));
    let inserted = 0;
    for (const eventId of toSeed) {
      for (let i = 0; i < STATIC_REVIEWS.length; i += 1) {
        const r = STATIC_REVIEWS[i];
        const id = randomUUID();
        const sentimentScore = r.sentiment === 'positive' ? 0.8 : r.sentiment === 'negative' ? -0.6 : 0;
        const createdAt = new Date(Date.now() - ((STATIC_REVIEWS.length - i) * 24 * 60 * 60 * 1000));
        await client.query(
          `INSERT INTO event_reviews (
             id, event_id, rating, comment, sentiment, sentiment_score,
             language, source, is_seeded, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'unknown', 'seed', true, $7, $7)`,
          [id, eventId, r.rating, r.comment, r.sentiment, sentimentScore, createdAt]
        );
        inserted += 1;
      }
    }
    console.log(`Seeded ${inserted} static reviews across ${toSeed.length} event(s). ${eventIds.length - toSeed.length} event(s) already had reviews.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seedEventReviews().catch((e) => {
  console.error(e);
  process.exit(1);
});
