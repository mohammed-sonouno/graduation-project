/**
 * Verifies 041/042 advisor data: table exists, row count, sample distinct greetings,
 * and U&/JSON polish from 042 (ASCII file) vs plain text from 041.
 * Usage: node scripts/verify-major-advisor-db.mjs */
import 'dotenv/config';
import { pool } from '../server/db/pool.js';

async function main() {
  const checks = [];

  const tbl = await pool.query(`
 SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'major_chat_context'
    ) AS exists
  `);
  checks.push(['Table major_chat_context exists', tbl.rows[0]?.exists === true]);

  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'major_chat_context'
    ORDER BY ordinal_position
  `);
  const names = cols.rows.map((r) => r.column_name);
  const need = ['major_id', 'greeting_en', 'greeting_ar', 'suggested_questions_en', 'suggested_questions_ar'];
  checks.push(['Required columns present', need.every((c) => names.includes(c))]);

  const cnt = await pool.query('SELECT count(*)::int AS n FROM major_chat_context');
  const n = cnt.rows[0]?.n ?? 0;
  checks.push(['At least 13 seeded majors', n >= 13]);

  const distinctGreetings = await pool.query(`
    SELECT count(DISTINCT greeting_en)::int AS n FROM major_chat_context WHERE greeting_en IS NOT NULL AND trim(greeting_en) <> ''
  `);
  const dg = distinctGreetings.rows[0]?.n ?? 0;
  checks.push(['Multiple distinct English greetings (majors differ)', dg >= 3]);

  const sample = await pool.query(`
    SELECT major_id,
           left(trim(greeting_en), 80) AS greeting_en_preview,
           jsonb_array_length(suggested_questions_en) AS n_en,
           jsonb_array_length(suggested_questions_ar) AS n_ar
    FROM major_chat_context
    ORDER BY major_id
    LIMIT 5
  `);

  const mis = await pool.query(
    `SELECT greeting_en FROM major_chat_context WHERE major_id = 'eng-mis'`
  );
  const cs = await pool.query(
    `SELECT greeting_en FROM major_chat_context WHERE major_id = 'eng-cs'`
  );
  const gMis = mis.rows[0]?.greeting_en || '';
  const gCs = cs.rows[0]?.greeting_en || '';
  checks.push(['eng-mis and eng-cs have different greetings', gMis !== gCs && gMis.length > 0 && gCs.length > 0]);

  // 042 polish: MIS greeting should mention "Management Information Systems" explicitly in EN
  const looks042 =
    /Management Information Systems/i.test(gMis) &&
    /Welcome - I'm your academic advisor/i.test(gMis);
  checks.push(['042 polish likely applied (MIS English greeting pattern)', looks042]);

  console.log('--- major_chat_context verification ---\n');
  for (const [label, ok] of checks) {
    console.log(ok ? '[OK]' : '[FAIL]', label);
  }
  console.log('\nSample rows (first 5 by major_id):');
  console.log(JSON.stringify(sample.rows, null, 2));
  console.log('\nRow count:', n);

  const allOk = checks.every(([, ok]) => ok);
  await pool.end();
  process.exitCode = allOk ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
