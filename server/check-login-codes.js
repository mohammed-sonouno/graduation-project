/**
 * Verify that 6-digit login codes are generated, saved to DB, and read back correctly.
 * Usage: node server/check-login-codes.js
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });

const LOGIN_CODE_EXPIRY_MINUTES = 10;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function run() {
  const client = await pool.connect();
  const testEmail = 'login-code-test@stu.najah.edu';
  let code;
  try {
    // 1. Generate 6-digit code (same as server)
    code = generateCode();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      console.error('FAIL: Generated code is not 6 digits:', code);
      process.exit(1);
    }
    console.log('Generated 6-digit code:', code);

    // 2. Save to DB (same INSERT as server)
    const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000);
    await client.query(
      'INSERT INTO login_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [testEmail, code, expiresAt]
    );
    console.log('Saved to login_codes (email, code, expires_at)');

    // 3. Read from DB using same query as verify-login-code
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    const r = await client.query(
      'SELECT id, email, code FROM login_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [testEmail, normalizedCode]
    );
    if (r.rows.length === 0) {
      console.error('FAIL: Code not found when reading from DB (email, code, expires_at > NOW())');
      process.exit(1);
    }
    const row = r.rows[0];
    if (row.code !== code && row.code !== normalizedCode) {
      console.error('FAIL: Read code mismatch. Stored:', row.code, 'Expected:', code);
      process.exit(1);
    }
    console.log('Read from DB OK: id=', row.id, 'email=', row.email, 'code=', row.code);

    // 4. Clean up: delete test row (same as after successful verify)
    await client.query('DELETE FROM login_codes WHERE email = $1', [testEmail]);
    console.log('Deleted test row from login_codes');

    console.log('\nLogin codes check OK: generate → save → read from DB works.');
  } catch (err) {
    console.error('FAIL:', err.message);
    try {
      await client.query('DELETE FROM login_codes WHERE email = $1', [testEmail]);
    } catch (_) {}
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
