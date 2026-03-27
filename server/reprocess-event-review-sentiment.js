import 'dotenv/config';
import pg from 'pg';

// This script re-runs the current NLP service for existing event_reviews comments
// and updates sentiment fields so analytics reflect the latest sentiment logic.

const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

async function fetchReviewsNeedingReprocess() {
  // All real (non-seeded) reviews with a non-empty comment.
  const result = await pool.query(
    `SELECT id,
            comment,
            sentiment AS old_sentiment,
            sentiment_score AS old_sentiment_score,
            sentiment_raw AS old_sentiment_raw,
            language AS old_language,
            override_sentiment
     FROM event_reviews
     WHERE comment IS NOT NULL
       AND LENGTH(TRIM(comment)) > 0
       AND (is_seeded IS NOT TRUE)
     ORDER BY created_at ASC`
  );
  return result.rows || [];
}

async function analyzeCommentWithNlp(comment) {
  const NLP_SERVICE_URL =
    process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8001';
  const NLP_DEBUG =
    process.env.NLP_DEBUG === '1' || process.env.NLP_DEBUG === 'true';
  const NLP_TIMEOUT_MS =
    Math.max(500, parseInt(process.env.NLP_TIMEOUT_MS || '3000', 10) || 3000);

  const url = `${NLP_SERVICE_URL.replace(/\/+$/, '')}/analyze-sentiment`;
  const payload = { text: comment };

  if (NLP_DEBUG) {
    console.info('[reprocess-nlp] request', JSON.stringify({ url, payload }));
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), NLP_TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(t);
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error(data?.detail || data?.error || `NLP service error: ${r.status}`);
    }

    const out = data || {};
    const s = String(out.sentiment || '').toLowerCase();
    if (!['positive', 'neutral', 'negative'].includes(s)) {
      throw new Error(`Invalid NLP sentiment: ${out.sentiment}`);
    }

    const sentiment = s;
    const sentimentScore =
      typeof out.score === 'number' && Number.isFinite(out.score)
        ? out.score
        : 0;
    const language =
      typeof out.language === 'string' && out.language.trim()
        ? out.language.trim()
        : 'unknown';
    const sentimentRaw = out;

    if (NLP_DEBUG) {
      console.info('[reprocess-nlp] response', JSON.stringify(out));
    }

    return { sentiment, sentimentScore, language, sentimentRaw };
  } catch (err) {
    clearTimeout(t);
    console.warn(
      '[reprocess-nlp] failed for comment, keeping existing sentiment',
      { error: String(err?.message || err) }
    );
    return null;
  }
}

async function updateReviewSentiment(id, sentimentData) {
  const { sentiment, sentimentScore, language, sentimentRaw } = sentimentData;
  await pool.query(
    `UPDATE event_reviews
     SET sentiment = $2,
         sentiment_score = $3,
         sentiment_raw = $4,
         language = $5
     WHERE id = $1`,
    [id, sentiment, sentimentScore, sentimentRaw, language]
  );
}

async function main() {
  console.log('Starting reprocess of event review sentiment…');
  const reviews = await fetchReviewsNeedingReprocess();
  console.log(`Found ${reviews.length} reviews with non-empty comments to reprocess.`);

  let processed = 0;
  let updated = 0;
  let changedPositiveToNeutral = 0;
  let changedAny = 0;
  for (const row of reviews) {
    processed += 1;
    const id = row.id;
    const comment = (row.comment || '').trim();
    if (!comment) continue;

    const sentimentData = await analyzeCommentWithNlp(comment);
    if (!sentimentData) continue;

    const oldSentiment = (row.old_sentiment || '').toLowerCase();
    const newSentiment = (sentimentData.sentiment || '').toLowerCase();

    // Always update to ensure stored sentiment matches current NLP output,
    // even if we *think* nothing changed (defensive against rounding issues).
    await updateReviewSentiment(id, sentimentData);
    updated += 1;
    changedAny += newSentiment !== oldSentiment ? 1 : 0;

    if (oldSentiment === 'positive' && newSentiment === 'neutral') {
      changedPositiveToNeutral += 1;
    }

    if (processed % 25 === 0) {
      console.log(
        `Processed ${processed}/${reviews.length} reviews… (updated=${updated})`
      );
    }
  }

  console.log(
    `Done. Processed ${processed} reviews with comments, updated ${updated} rows (changedAny=${changedAny}, positive→neutral=${changedPositiveToNeutral}).`
  );
  await pool.end();
}

main().catch((err) => {
  console.error('Reprocess script failed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});

