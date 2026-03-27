import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
// Same default as server/index.js (override with DATABASE_URL in .env)
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const pool = new Pool({ connectionString });

async function test() {
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT 1 AS ok, current_database() AS db');
    client.release();
    console.log('Connection OK');
    console.log('Database:', r.rows[0].db);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message);
    await pool.end();
    process.exit(1);
  }
}

test();
