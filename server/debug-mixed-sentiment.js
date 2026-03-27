import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function callNlp(text) {
  const res = await fetch('http://127.0.0.1:8001/analyze-sentiment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  const phrase = 'جيد مش كتير بس منيح حلو';
  const res = await pool.query(
    `SELECT id,
            event_id,
            comment,
            sentiment,
            override_sentiment,
            sentiment_score,
            language
     FROM event_reviews
     WHERE comment LIKE $1`,
    [`%${phrase}%`]
  );

  console.log(`Found ${res.rows.length} reviews matching phrase: "${phrase}"`);

  if (res.rows.length > 0) {
    const row = res.rows[0];
    const comment = row.comment || '';
    console.log(
      'DB_ROW',
      JSON.stringify({
        id: row.id,
        event_id: row.event_id,
        comment,
        commentLength: comment.length,
        sentiment: row.sentiment,
        override_sentiment: row.override_sentiment,
        sentiment_score: row.sentiment_score,
        language: row.language,
      })
    );

    const nlp = await callNlp(comment);
    console.log(
      'LIVE_NLP',
      JSON.stringify({
        status: nlp.status,
        body: nlp.body,
      })
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error('debug-mixed-sentiment failed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});


