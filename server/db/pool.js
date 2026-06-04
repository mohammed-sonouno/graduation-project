import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:123@localhost:5432/graduation%20Project';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});
