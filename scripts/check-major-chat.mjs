import 'dotenv/config';
import { pool } from '../server/db/pool.js';

const r = await pool.query(`
  SELECT m.id, x.major_id AS ctx_id,
         (x.greeting_en IS NOT NULL AND length(trim(x.greeting_en)) > 0) AS has_greeting
  FROM majors m
  LEFT JOIN major_chat_context x ON x.major_id = m.id
  ORDER BY m.id
`);
console.log(JSON.stringify(r.rows, null, 2));
const c = await pool.query('SELECT count(*)::int AS n FROM major_chat_context');
console.log('major_chat_context rows:', c.rows[0]?.n);
await pool.end();
