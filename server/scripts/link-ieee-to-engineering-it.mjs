/**
 * One-off / ops: bind association "IEEE" to Faculty of Engineering (IEEE governance).
 * Uses DATABASE_URL from .env.
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const ENG_FACULTY = 'Faculty of Engineering';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eng = await client.query(
      `SELECT id FROM colleges WHERE lower(trim(name)) = lower(trim($1)) ORDER BY id LIMIT 1`,
      [ENG_FACULTY]
    );
    if (eng.rows.length === 0) {
      console.error(`No "${ENG_FACULTY}" college row — run npm run migrate first.`);
      await client.query('ROLLBACK');
      process.exitCode = 1;
      return;
    }
    const engId = eng.rows[0].id;

    const upId = await client.query(
      `UPDATE communities SET college_id = $1 WHERE lower(trim(name)) = 'ieee' RETURNING id, name, college_id`,
      [engId]
    );
    console.log('Updated college_id for IEEE rows:', upId.rowCount);
    if (upId.rows.length) console.table(upId.rows);

    try {
      const upArr = await client.query(
        `UPDATE communities SET colleges = $1::text[] WHERE lower(trim(name)) = 'ieee' RETURNING id, colleges`,
        [[ENG_FACULTY]]
      );
      console.log('Updated colleges[] for IEEE:', upArr.rowCount);
    } catch (e) {
      if (e.code === '42703') {
        console.log('Column communities.colleges not present; skipped.');
      } else throw e;
    }

    try {
      const upKind = await client.query(
        `UPDATE communities SET kind = 'association' WHERE lower(trim(name)) = 'ieee' RETURNING id, kind`
      );
      console.log('Set kind=association for IEEE:', upKind.rowCount);
    } catch (e) {
      if (e.code === '42703') console.log('Column communities.kind not present; skipped.');
      else throw e;
    }

    await client.query('COMMIT');
    console.log('Done. IEEE →', ENG_FACULTY, '(college id', engId + ')');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
