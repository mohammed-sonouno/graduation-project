import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isEmailAllowed, MIN_PASSWORD_LENGTH, validatePassword as validatePasswordRules, isAdminRole, isDeanRole, isSupervisorRole, isCommunityLeaderRole, isStudentRole, EVENT_REQUIRED_FIELDS } from '../config/rules.js';

const { Pool } = pg;
const app = express();
// Backend default port (override with PORT in .env if needed)
const PORT = process.env.PORT || 2000;
const JWT_SECRET = process.env.JWT_SECRET || 'graduation-project-secret';

// Default DB: 10.20.10.20:5433, user postgres, database "graduation Project" (override with DATABASE_URL in .env)
const DEFAULT_DATABASE_URL = 'postgresql://postgres:Ss%402004%24@10.20.10.20:5433/graduation%20Project';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

const ADMIN_EMAIL = 'admin@najah.edu';
const ADMIN_PASSWORD = '123456';

async function ensureAdminUser() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const r = await client.query('SELECT 1 FROM app_users WHERE email = $1 LIMIT 1', [ADMIN_EMAIL]);
    if (r.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET password_hash = $1, role = 'admin' WHERE email = $2",
        [hash, ADMIN_EMAIL]
      );
      console.log('Admin user password refreshed: admin@najah.edu');
      return true;
    }
    const old = await client.query("SELECT 1 FROM app_users WHERE email = 'admin' LIMIT 1");
    if (old.rows.length > 0) {
      await client.query(
        "UPDATE app_users SET email = $1, password_hash = $2, role = 'admin' WHERE email = 'admin'",
        [ADMIN_EMAIL, hash]
      );
      console.log('Admin user migrated to admin@najah.edu');
      return true;
    }
    await client.query(
      "INSERT INTO app_users (email, password_hash, role) VALUES ($1, $2, 'admin')",
      [ADMIN_EMAIL, hash]
    );
    console.log('Admin user created: admin@najah.edu, password 123456');
    return true;
  } catch (err) {
    console.error('ensureAdminUser failed:', err?.message || err);
    if (err?.code === '42P01') {
      console.error('Table app_users missing. Run: npm run migrate');
    }
    return false;
  } finally {
    client.release();
  }
}

// Allow frontend origin(s): when using Vite proxy, browser origin may be 3000 or 5173
const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173'];
app.disable('x-powered-by');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, CORS_ORIGINS[0]);
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' })); // allow base64 images for profile picture

// Parse Cookie header so we can read auth_token (no localStorage; auth lives in httpOnly cookie or DB)
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  cookieHeader.split(';').forEach((s) => {
    const idx = s.indexOf('=');
    if (idx > 0) {
      const key = s.slice(0, idx).trim();
      const val = s.slice(idx + 1).trim().replace(/^"|"$/g, '');
      if (key) out[key] = decodeURIComponent(val);
    }
  });
  return out;
}

const AUTH_COOKIE = 'auth_token';
const COOKIE_OPTS = (maxAgeDays = 7) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
});

function setAuthCookie(res, token, rememberMe = false) {
  const days = rememberMe ? 30 : 7;
  res.cookie(AUTH_COOKIE, token, { ...COOKIE_OPTS(days), path: '/' });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { path: '/', httpOnly: true, sameSite: 'strict' });
}

async function createNotification(userId, title, message) {
  if (!userId || !title) return;
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1,$2,$3)',
      [userId, String(title).slice(0, 255), message ?? '']
    );
  } catch (err) {
    console.error('createNotification error:', err);
  }
}

// ---------- Shared validation helpers ----------

function validateRequiredEventFields(body) {
  const missing = [];
  for (const key of EVENT_REQUIRED_FIELDS) {
    const v = body[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      missing.push(key);
    }
  }
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  if (Number.isNaN(Number(body.availableSeats)) || Number(body.availableSeats) < 0) {
    return 'availableSeats must be a non-negative number';
  }
  if (Number.isNaN(Number(body.price)) || Number(body.price) < 0) {
    return 'price must be a non-negative number';
  }
  return null;
}

// Lightweight structured auth logging (without sensitive data)
function logAuth(event, details) {
  try {
    const safe = {
      event,
      email: details?.email ? String(details.email).toLowerCase() : undefined,
      provider: details?.provider,
      success: details?.success,
      reason: details?.reason,
      userId: details?.userId,
    };
    // Avoid logging entire error objects or request bodies
    console.info('[auth]', JSON.stringify(safe));
  } catch {
    // Never break the request if logging fails
  }
}

/** Build user object from DB row (no password_hash). Includes Gmail-sourced fields: email, first_name, middle_name, last_name, student_number. */
function toUser(row) {
  const name = row.name ?? (([row.first_name, row.last_name].filter(Boolean).join(' ') || row.email));
  return {
    id: row.id != null ? Number(row.id) : undefined,
    email: row.email,
    role: row.role,
    name,
    first_name: row.first_name ?? undefined,
    middle_name: row.middle_name ?? undefined,
    last_name: row.last_name ?? undefined,
    student_number: row.student_number ?? undefined,
    created_at: row.created_at,
    college_id: row.college_id != null ? Number(row.college_id) : undefined,
    community_id: row.community_id != null ? Number(row.community_id) : undefined,
    must_change_password: Boolean(row.must_change_password),
    must_complete_profile: Boolean(row.must_complete_profile),
  };
}

/** Optional auth: set req.user from JWT if present (cookie first, then Authorization header). */
async function optionalAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = req.headers.authorization;
  const token = cookies[AUTH_COOKIE] || (auth && auth.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const r = await pool.query(
'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile FROM app_users WHERE id = $1',
    [payload.userId]
    );
    req.user = r.rows[0] ? toUser(r.rows[0]) : null;
  } catch {
    req.user = null;
  }
  next();
}

/** Require auth; 401 if not logged in. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

/** Require admin role (admin has all permissions: events, approval, dashboard, and any future admin feature). */
function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

/** Attach permissions from user.role (stored in DB). Frontend uses these to show/hide menus and content per role. */
function withPermissions(user) {
  if (!user) return user;
  const admin = isAdminRole(user.role);
  const dean = isDeanRole(user.role);
  const supervisor = isSupervisorRole(user.role);
  const communityLeader = isCommunityLeaderRole(user.role);
  const student = isStudentRole(user.role) || user.role === 'user';
  return {
    ...user,
    permissions: {
      admin,
      dean,
      supervisor,
      communityLeader,
      student,
      manageEvents: admin,
      approveEvents: admin,
      dashboard: admin,
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend running' });
});

// ========== Auth: all accounts and login are stored/verified in DB (app_users) ==========
// Session tokens are never issued without the required steps:
// - Email sign-in: request-login-code (user must exist) → verify-login-code with valid 6-digit code → then JWT.
// - Google sign-in: POST /api/auth/google never returns a token; it always sends a 6-digit code. Existing user →
//   verify-login-code; new user → verify-google-new-code (valid code + tempToken) → complete-registration with tempToken → then JWT.
// - Register (email): POST /api/auth/register with email + password only (no code).
// - Register (Google): Google → code → verify-google-new-code → complete-registration (tempToken required) → JWT.
// - POST /api/auth/login: legacy password login (accounts with password_hash only).

/** GET /api/auth/me — return current user from DB using Bearer token. All user data is read from app_users (DB is source of truth). */
app.get('/api/auth/me', optionalAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = withPermissions(req.user);
  if (user.college_id) {
    const r = await pool.query('SELECT name FROM colleges WHERE id = $1', [user.college_id]);
    user.collegeName = r.rows[0]?.name;
  }
  if (user.community_id) {
    const r = await pool.query('SELECT name FROM communities WHERE id = $1', [user.community_id]);
    user.communityName = r.rows[0]?.name;
  }
  res.json({ user });
});

/** POST /api/auth/logout — clear auth cookie (no localStorage; session lives in cookie). */
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** GET /api/auth/pending-registration?sessionId= — load pending Google registration from DB (no sessionStorage). */
app.get('/api/auth/pending-registration', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    const r = await pool.query(
      'SELECT email, name, picture FROM pending_registrations WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Session expired or invalid. Please sign in with Google again.' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('pending-registration get error:', err);
    res.status(500).json({ error: 'Failed to load session.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const body = req.body || {};
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const passwordRaw = typeof body.password === 'string' ? body.password : '';
  if (!emailRaw || !passwordRaw) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (emailRaw.length > 255) {
    return res.status(400).json({ error: 'Email is too long.' });
  }
  if (passwordRaw.length > 200) {
    return res.status(400).json({ error: 'Password is too long.' });
  }
  const emailNorm = emailRaw.toLowerCase();
  if (!isEmailAllowed(emailNorm)) {
    return res.status(400).json({
      error: 'Please use a university email (@stu.najah.edu or @najah.edu).',
    });
  }
  const pwdCheck = validatePasswordRules(passwordRaw);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: `Password: ${pwdCheck.errors.join(', ')}.` });
  }
  const college = typeof req.body.college === 'string' ? req.body.college.trim() : '';
  const major = typeof req.body.major === 'string' ? req.body.major.trim() : '';
  if (!college || !major) {
    return res.status(400).json({ error: 'College and major are required. Please select your college and academic program.' });
  }
  try {
    const existing = await pool.query('SELECT 1 FROM app_users WHERE email = $1 LIMIT 1', [emailNorm]);
    if (existing.rows.length > 0) {
      logAuth('register', { email: emailNorm, success: false, reason: 'email_exists' });
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }
    const hash = await bcrypt.hash(passwordRaw.trim(), 10);
    const r = await pool.query(
      "INSERT INTO app_users (email, password_hash, role, college, major) VALUES ($1, $2, 'student', $3, $4) RETURNING id, email, role, created_at",
      [emailNorm, hash, college, major]
    );
    const row = r.rows[0];
    const token = jwt.sign({ userId: row.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token, false);
    const userRow = {
      ...row,
      college_id: null,
      community_id: null,
      first_name: null,
      last_name: null,
      middle_name: null,
      must_change_password: false,
      must_complete_profile: true,
      name: row.email,
    };
    const user = withPermissions(toUser(userRow));
    // Ensure frontend redirects to complete-profile after signup
    user.must_complete_profile = true;
    try {
      await pool.query('UPDATE app_users SET must_complete_profile = true WHERE id = $1', [row.id]);
    } catch (_) {
      // Column may not exist yet; response already has must_complete_profile for redirect
    }
    logAuth('register', { email: emailNorm, success: true, userId: user.id });
    await createNotification(user.id, 'Welcome to Najah platform', 'Your student account has been created successfully.');
    res.status(201).json({ user });
  } catch (err) {
    console.error('Register error:', err);
    logAuth('register', { email: emailNorm, success: false, reason: 'server_error' });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const raw = req.body || {};
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password.trim() : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (email.length > 255) {
    return res.status(400).json({ error: 'Email is too long.' });
  }
  if (password.length > 200) {
    return res.status(400).json({ error: 'Password is too long.' });
  }
  const emailNorm = email.toLowerCase();
  try {
    let r = await pool.query(
      'SELECT id, email, password_hash, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
      [emailNorm]
    );
    let row = r.rows[0];
    if (!row && emailNorm === ADMIN_EMAIL) {
      await ensureAdminUser();
      r = await pool.query(
        'SELECT id, email, password_hash, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
        [emailNorm]
      );
      row = r.rows[0];
    }
    if (!row) {
      logAuth('login', { email: emailNorm, success: false, reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const hash = row.password_hash;
    if (!hash || typeof hash !== 'string') {
      logAuth('login', { email: emailNorm, success: false, reason: 'no_hash' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    let match = false;
    try {
      match = await bcrypt.compare(password, hash);
    } catch (bcryptErr) {
      console.error('Login bcrypt error:', bcryptErr);
      logAuth('login', { email: emailNorm, success: false, reason: 'bcrypt_error' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!match) {
      logAuth('login', { email: emailNorm, success: false, reason: 'bad_password' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const user = withPermissions(toUser(row));
    if (!user || !user.id) {
      console.error('Login: invalid user object after toUser');
      logAuth('login', { email: emailNorm, success: false, reason: 'invalid_user_object' });
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
    if (user.college_id != null) {
      const cr = await pool.query('SELECT name FROM colleges WHERE id = $1', [user.college_id]);
      user.collegeName = cr.rows[0]?.name;
    }
    if (user.community_id != null) {
      const cr = await pool.query('SELECT name FROM communities WHERE id = $1', [user.community_id]);
      user.communityName = cr.rows[0]?.name;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token, false);
    logAuth('login', { email: emailNorm, success: true, userId: user.id });
    await createNotification(user.id, 'New login', 'A new sign-in to your Najah account was detected.');
    res.json({ user });
  } catch (err) {
    console.error('Login error:', err?.message || err);
    if (err?.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready. Run migrations: npm run migrate' });
    }
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Cannot connect to database. Check DATABASE_URL and that the database is running.' });
    }
    logAuth('login', { email: emailNorm, success: false, reason: 'server_error' });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

const LOGIN_CODE_EXPIRY_MINUTES = 10;
const JWT_EXPIRY_SESSION = '7d';
const JWT_EXPIRY_REMEMBER = '30d';

/** POST /api/auth/request-login-code — send 6-digit code to email. Body: { email }. User must exist. */
app.post('/api/auth/request-login-code', async (req, res) => {
  try {
    const raw = req.body || {};
    const email = typeof raw.email === 'string' ? raw.email.trim() : '';
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    if (email.length > 255) return res.status(400).json({ error: 'Email is too long.' });
    const emailNorm = email.toLowerCase();
    if (!isEmailAllowed(emailNorm)) {
      return res.status(400).json({ error: 'Please use a university email (@stu.najah.edu or @najah.edu).' });
    }
    const r = await pool.query('SELECT 1 FROM app_users WHERE email = $1 LIMIT 1', [emailNorm]);
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please register first.' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000);
    await pool.query(
      'INSERT INTO login_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [emailNorm, code, expiresAt]
    );
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
        });
        const plainText = `Dear,

Thank you for using the An-Najah National University online services.

To complete the verification of your email address, please use the verification code below:

Verification Code: [${code}]

Please enter this code on the verification page to confirm your email address.
This code is valid for a limited time only.

If you did not request this verification, please ignore this email.

Best regards,

An-Najah National University`;
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: emailNorm,
          subject: 'Your Najah login code',
          text: plainText,
          html: `<p>Dear,</p>
<p>Thank you for using the An-Najah National University online services.</p>
<p>To complete the verification of your email address, please use the verification code below:</p>
<p><strong>Verification Code: [${code}]</strong></p>
<p>Please enter this code on the verification page to confirm your email address.<br/>
This code is valid for a limited time only.</p>
<p>If you did not request this verification, please ignore this email.</p>
<p>Best regards,<br/>An-Najah National University</p>`,
        });
      } catch (mailErr) {
        console.error('Send login code email error:', mailErr);
      }
    } else {
      console.info('[login code]', emailNorm, '→', code);
    }
    const payload = { success: true };
    if (process.env.NODE_ENV !== 'production') payload.devCode = code;
    res.json(payload);
  } catch (err) {
    if (err?.code === '42P01') return res.status(503).json({ error: 'Database not ready. Run migrations: npm run migrate' });
    console.error('request-login-code error:', err);
    res.status(500).json({ error: 'Could not send login code. Please try again.' });
  }
});

/** POST /api/auth/verify-login-code — verify 6-digit code and sign in. Body: { email, code, rememberMe? }. */
app.post('/api/auth/verify-login-code', async (req, res) => {
  try {
    const raw = req.body || {};
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    const code = typeof raw.code === 'string' ? raw.code.replace(/\D/g, '').slice(0, 6) : '';
    const rememberMe = Boolean(raw.rememberMe);
    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: 'Email and a 6-digit code are required.' });
    }
    const r = await pool.query(
      'SELECT id, email, code FROM login_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, code]
    );
    if (r.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired code. Request a new code.' });
    }
    await pool.query('DELETE FROM login_codes WHERE email = $1', [email]);
    const userRow = (await pool.query(
      'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
      [email]
    )).rows[0];
    if (!userRow) return res.status(401).json({ error: 'Account not found.' });
    const user = withPermissions(toUser(userRow));
    if (user.college_id != null) {
      const cr = await pool.query('SELECT name FROM colleges WHERE id = $1', [user.college_id]);
      user.collegeName = cr.rows[0]?.name;
    }
    if (user.community_id != null) {
      const cr = await pool.query('SELECT name FROM communities WHERE id = $1', [user.community_id]);
      user.communityName = cr.rows[0]?.name;
    }
    const expiresIn = rememberMe ? JWT_EXPIRY_REMEMBER : JWT_EXPIRY_SESSION;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn });
    setAuthCookie(res, token, rememberMe);
    logAuth('login', { email, success: true, userId: user.id, provider: 'code' });
    await createNotification(user.id, 'New login', 'A new sign-in to your Najah account was detected.');
    res.json({ user });
  } catch (err) {
    console.error('verify-login-code error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/** POST /api/auth/verify-google-new-code — for new Google users: verify 6-digit code, return verified + tempToken so frontend can go to Complete Profile. Body: { email, code, tempToken }. */
app.post('/api/auth/verify-google-new-code', async (req, res) => {
  try {
    const raw = req.body || {};
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    const code = typeof raw.code === 'string' ? raw.code.replace(/\D/g, '').slice(0, 6) : '';
    const tempToken = raw.tempToken;
    if (!email || !code || code.length !== 6 || !tempToken) {
      return res.status(400).json({ error: 'Email, 6-digit code, and tempToken are required.' });
    }
    const r = await pool.query(
      'SELECT id FROM login_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, code]
    );
    if (r.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired code. Sign in with Google again to get a new code.' });
    }
    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired. Please sign in with Google again.' });
    }
    const payloadEmail = (payload.email && (payload.email + '').trim().toLowerCase()) || '';
    if (payloadEmail !== email || !payload.pendingRegistration) {
      return res.status(403).json({ error: 'Invalid session. Please sign in with Google again.' });
    }
    await pool.query('DELETE FROM login_codes WHERE email = $1', [email]);
    logAuth('google_new_code_verify', { email, success: true });
    // Store pending registration in DB (no sessionStorage); frontend uses sessionId
    const pr = await pool.query(
      `INSERT INTO pending_registrations (email, name, picture) VALUES ($1, $2, $3) RETURNING id`,
      [payloadEmail, payload.name || null, payload.picture || null]
    );
    const sessionId = pr.rows[0].id;
    res.json({ verified: true, sessionId, email: payloadEmail, name: payload.name || null, picture: payload.picture || null });
  } catch (err) {
    console.error('verify-google-new-code error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential, access_token } = req.body || {};
  if (!credential && !access_token) {
    return res.status(400).json({ error: 'Missing Google credential or access_token' });
  }
  try {
    let data;
    if (credential) {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
      const resp = await fetch(url);
      data = await resp.json();
      if (!resp.ok) {
        return res.status(401).json({ error: 'Invalid Google sign-in. Please try again.' });
      }
    } else {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      data = await resp.json();
      if (!resp.ok) {
        return res.status(401).json({ error: 'Invalid Google sign-in. Please try again.' });
      }
    }
    const email = data.email;
    const emailVerified = data.email_verified;
    const isVerified = emailVerified === true || emailVerified === 'true';
    if (!email || (emailVerified !== undefined && !isVerified)) {
      logAuth('google', { provider: 'google', email, success: false, reason: 'unverified_email' });
      return res.status(401).json({ error: 'Could not verify your Google account.' });
    }
    if (!isEmailAllowed(email)) {
      logAuth('google', { provider: 'google', email, success: false, reason: 'domain_not_allowed' });
      return res.status(403).json({
        error: 'Please use a Najah University Google account (@stu.najah.edu or @najah.edu).',
      });
    }
    const emailNorm = email.trim().toLowerCase();
    let row = (await pool.query(
'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
    [emailNorm]
  )).rows[0];

    // Send 6-digit code for both existing and new users (same as email sign-in flow).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000);
    await pool.query(
      'INSERT INTO login_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [emailNorm, code, expiresAt]
    );
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
        });
        const plainText = `Dear,

Thank you for using the An-Najah National University online services.

To complete the verification of your email address, please use the verification code below:

Verification Code: [${code}]

Please enter this code on the verification page to confirm your email address.
This code is valid for a limited time only.

If you did not request this verification, please ignore this email.

Best regards,

An-Najah National University`;
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: emailNorm,
          subject: 'Your Najah login code',
          text: plainText,
          html: `<p>Dear,</p>
<p>Thank you for using the An-Najah National University online services.</p>
<p>To complete the verification of your email address, please use the verification code below:</p>
<p><strong>Verification Code: [${code}]</strong></p>
<p>Please enter this code on the verification page to confirm your email address.<br/>
This code is valid for a limited time only.</p>
<p>If you did not request this verification, please ignore this email.</p>
<p>Best regards,<br/>An-Najah National University</p>`,
        });
      } catch (mailErr) {
        console.error('Send login code email error:', mailErr);
      }
    } else {
      console.info('[login code]', emailNorm, '→', code);
    }

    // Never return a session token here; user must verify the 6-digit code, then (new user) complete-registration.
    const result = { needsCode: true, email: emailNorm };
    if (process.env.NODE_ENV !== 'production') result.devCode = code;

    if (!row) {
      // New Google user: return tempToken so after code verification frontend can go to Complete Profile.
      const tempToken = jwt.sign(
        {
          email: emailNorm,
          name: data.name || emailNorm,
          given_name: data.given_name || null,
          family_name: data.family_name || null,
          picture: data.picture || null,
          pendingRegistration: true,
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      result.newUser = true;
      result.tempToken = tempToken;
      result.name = data.name || emailNorm;
      result.picture = data.picture || null;
      logAuth('google', { provider: 'google', email: emailNorm, success: true, reason: 'pending_registration' });
      return res.json(result);
    }
    logAuth('google', { provider: 'google', email: emailNorm, success: true, reason: 'needs_code' });
    res.json(result);
  } catch (err) {
    console.error('Google auth error:', err);
    logAuth('google', { provider: 'google', success: false, reason: 'server_error' });
    res.status(500).json({ error: 'Sign-in failed. Please try again.' });
  }
});

/** POST /api/auth/change-password — require auth; body: oldPassword, newPassword. Updates password_hash and sets must_change_password = false. */
app.post('/api/auth/change-password', optionalAuth, requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  const pwdCheck = validatePasswordRules(newPassword);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: `New password: ${pwdCheck.errors.join(', ')}.` });
  }
  try {
    const r = await pool.query('SELECT password_hash FROM app_users WHERE id = $1', [req.user.id]);
    const row = r.rows[0];
    if (!row?.password_hash) {
      return res.status(400).json({ error: 'Cannot change password for this account.' });
    }
    const match = await bcrypt.compare(oldPassword, row.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE app_users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [hash, req.user.id]
    );
    const updated = withPermissions({ ...toUser(req.user), must_change_password: false });
    await createNotification(req.user.id, 'Password changed', 'Your Najah account password was changed successfully.');
    res.json({ user: updated });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

/** POST /api/auth/complete-registration — no auth; body: sessionId (from DB) or tempToken, plus form fields.
 *  sessionId: load pending_registrations from DB. tempToken: legacy JWT payload. Auth stored in cookie only.
 */
app.post('/api/auth/complete-registration', async (req, res) => {
  const body = req.body || {};
  const sessionId = body.sessionId;
  const tempToken = body.tempToken;
  let payloadEmail = '';
  let nameFromToken = '';
  let pictureFromPayload = null;

  if (sessionId) {
    const pr = await pool.query(
      'SELECT email, name, picture FROM pending_registrations WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    );
    if (pr.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in with Google again.' });
    }
    const row = pr.rows[0];
    payloadEmail = (row.email && (row.email + '').trim().toLowerCase()) || '';
    nameFromToken = (typeof row.name === 'string' ? row.name.trim() : '') || payloadEmail;
    pictureFromPayload = row.picture || null;
  } else if (tempToken) {
    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Registration link expired. Please sign in with Google again.' });
    }
    if (!payload.pendingRegistration || !payload.email) {
      return res.status(401).json({ error: 'Invalid registration token. Please sign in with Google again.' });
    }
    payloadEmail = (payload.email && (payload.email + '').trim().toLowerCase()) || '';
    nameFromToken = (typeof payload.name === 'string' ? payload.name.trim() : '') || payloadEmail;
    pictureFromPayload = payload.picture || null;
  } else {
    return res.status(400).json({ error: 'Missing sessionId or tempToken. Please sign in with Google again.' });
  }

  const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') || payloadEmail;
  if (!email || email !== payloadEmail) {
    return res.status(403).json({ error: 'Email does not match. Please use the same Google account.' });
  }

  const normalizedName = nameFromToken.replace(/\s+/g, ' ').trim();
  const parts = normalizedName ? normalizedName.split(' ').filter(Boolean) : [];
  const studentFromEmail = payloadEmail ? (payloadEmail.split('@')[0] || '').trim() : '';
  let first_name = parts[0] || '';
  let father_name = parts[1] || null;
  let third_name = parts[2] || null;
  if (parts.length >= 4) { father_name = father_name || parts[1]; third_name = third_name || parts[2]; }
  if (parts.length === 3 && !father_name) father_name = parts[1];
  const middle_name = [father_name, third_name].filter(Boolean).join(' ') || null;
  let family_name = parts.length >= 2 ? parts[parts.length - 1] : parts[0] || '';
  if (parts.length === 1 && parts[0] && !family_name) family_name = parts[0];
  let student_number = studentFromEmail;
  if (student_number && (!first_name || !family_name)) {
    if (!first_name) first_name = student_number;
    if (!family_name) family_name = student_number;
  }
  const last_name_final = family_name || '';

  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (!first_name || !last_name_final || !student_number) {
    return res.status(400).json({ error: 'First name, family name, and student number are required.' });
  }
  let passwordHash = null;
  if (password) {
    const pwdCheck = validatePasswordRules(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: `Password: ${pwdCheck.errors.join(', ')}.` });
    }
    passwordHash = await bcrypt.hash(password, 10);
  }

  const college = typeof body.college === 'string' ? body.college.trim() : null;
  const major = typeof body.major === 'string' ? body.major.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  if (!college || !major) {
    return res.status(400).json({ error: 'College and major are required for every student.' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO app_users (email, password_hash, role, first_name, middle_name, last_name, student_number, college, major, phone, must_complete_profile)
       VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile`,
      [
        email,
        passwordHash,
        first_name,
        middle_name,
        last_name_final,
        student_number,
        college || null,
        major || null,
        phone || null,
      ]
    );
    const row = r.rows[0];
    if (sessionId) {
      await pool.query('DELETE FROM pending_registrations WHERE id = $1', [sessionId]);
    }
    const user = withPermissions(toUser({ ...row, name: [first_name, last_name_final].filter(Boolean).join(' ') || email }));
    if (pictureFromPayload) user.picture = pictureFromPayload;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);
    await createNotification(user.id, 'Welcome to Najah platform', 'Your student account has been created successfully.');
    res.json({ user });
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'This email or student number is already registered.' });
    console.error('Complete registration error:', err);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

/** POST /api/auth/complete-profile — require auth; body: email, first_name, father_name, third_name, family_name, student_number, password, etc. Values from "From your Google account" auto-fields; API falls back to current user from DB when missing. */
app.post('/api/auth/complete-profile', optionalAuth, requireAuth, async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email !== req.user.email) {
    return res.status(403).json({ error: 'Cannot update another user\'s profile.' });
  }
  // Take name and student number from body (auto-filled section); fall back to current user from DB when missing
  let first_name = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  let father_name = typeof body.father_name === 'string' ? body.father_name.trim() : null;
  let third_name = typeof body.third_name === 'string' ? body.third_name.trim() : null;
  let family_name = typeof body.family_name === 'string' ? body.family_name.trim() : '';
  let student_number = typeof body.student_number === 'string' ? body.student_number.trim() : '';
  const u = req.user;
  if (!first_name && u?.first_name) first_name = u.first_name;
  if (!family_name && u?.last_name) family_name = u.last_name;
  if (!student_number && u?.email) student_number = (u.email.split('@')[0] || '').trim();
  if ((father_name == null || third_name == null) && u?.middle_name) {
    const mid = u.middle_name.trim().split(/\s+/).filter(Boolean);
    if (father_name == null && mid[0]) father_name = mid[0];
    if (third_name == null && mid[1]) third_name = mid[1];
  }
  // Use student_number (from email) when body/DB lack first or family name (e.g. Google-filled flow)
  if (student_number && (!first_name || !family_name)) {
    if (!first_name) first_name = student_number;
    if (!family_name) family_name = student_number;
  }
  const middle_name = [father_name, third_name].filter(Boolean).join(' ') || null;
  const last_name = family_name; // use family_name after fallback so validation sees updated value
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (!first_name || !last_name || !student_number) {
    return res.status(400).json({ error: 'First name, family name, and student number are required.' });
  }
  const collegeVal = body.college ? String(body.college).trim() : null;
  const majorVal = body.major ? String(body.major).trim() : null;
  if (!collegeVal || !majorVal) {
    return res.status(400).json({ error: 'College and major are required for every student.' });
  }
  let hash = null;
  if (password) {
    const pwdCheck = validatePasswordRules(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: `Password: ${pwdCheck.errors.join(', ')}.` });
    }
    hash = await bcrypt.hash(password, 10);
  }
  try {
    if (hash != null) {
      await pool.query(
        `UPDATE app_users SET
          first_name = $1, middle_name = $2, last_name = $3, student_number = $4,
          college = $5, major = $6, phone = $7, password_hash = $8, must_complete_profile = false
          WHERE id = $9`,
        [
          first_name,
          middle_name,
          last_name,
          student_number,
          collegeVal,
          majorVal,
          body.phone ? String(body.phone).trim() : null,
          hash,
          req.user.id,
        ]
      );
    } else {
      await pool.query(
        `UPDATE app_users SET
          first_name = $1, middle_name = $2, last_name = $3, student_number = $4,
          college = $5, major = $6, phone = $7, must_complete_profile = false
          WHERE id = $8`,
        [
          first_name,
          middle_name,
          last_name,
          student_number,
          collegeVal,
          majorVal,
          body.phone ? String(body.phone).trim() : null,
          req.user.id,
        ]
      );
    }
    const r = await pool.query(
'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, student_number, must_change_password, must_complete_profile FROM app_users WHERE id = $1',
    [req.user.id]
  );
  const user = withPermissions(toUser(r.rows[0]));
  res.json({ user });
} catch (err) {
  if (err?.code === '23505') return res.status(409).json({ error: 'Student number is already in use.' });
  console.error('Complete profile error:', err);
    res.status(500).json({ error: 'Could not save profile. Please try again.' });
  }
});

// ---------- Data API (all from DB) ----------

/** GET /api/colleges */
app.get('/api/colleges', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, name FROM colleges ORDER BY id');
    res.json(r.rows);
  } catch (err) {
    console.error('colleges list error:', err);
    res.status(500).json({ error: 'Failed to load colleges' });
  }
});

/** GET /api/communities — list communities. Dean: only their college's; Supervisor: only their one community; Admin/unauthenticated: all (or ?college_id= filter). */
app.get('/api/communities', optionalAuth, async (req, res) => {
  try {
    const user = req.user;
    const collegeId = req.query.college_id != null ? req.query.college_id : (user?.role === 'dean' && user?.college_id != null ? String(user.college_id) : null);

    const leaderSelect = `, leader.id AS "leaderId", leader.email AS "leaderEmail",
      COALESCE(NULLIF(TRIM(leader.first_name || ' ' || COALESCE(leader.last_name, '')), ''), leader.email) AS "leaderName"`;
    const leaderJoin = ` LEFT JOIN app_users leader ON leader.community_id = c.id AND leader.role IN ('supervisor', 'community_leader')`;

    if ((user?.role === 'supervisor' || user?.role === 'community_leader') && user?.community_id != null) {
      const r = await pool.query(
        `SELECT c.id, c.name, c.college_id AS "collegeId", col.name AS "collegeName"${leaderSelect}
         FROM communities c JOIN colleges col ON col.id = c.college_id${leaderJoin}
         WHERE c.id = $1`,
        [user.community_id]
      );
      return res.json(r.rows.length ? [r.rows[0]] : []);
    }

    let q = `SELECT c.id, c.name, c.college_id AS "collegeId", col.name AS "collegeName"${leaderSelect}
      FROM communities c JOIN colleges col ON col.id = c.college_id${leaderJoin} WHERE 1=1`;
    const params = [];
    if (collegeId) {
      params.push(collegeId);
      q += ` AND c.college_id = $${params.length}`;
    }
    q += ' ORDER BY col.name, c.name';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('communities list error:', err);
    res.status(500).json({ error: 'Failed to load communities' });
  }
});

/** POST /api/communities — admin only. Body: { name, collegeId, leaderId }. Each community must have a supervisor. */
app.post('/api/communities', optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, collegeId, leaderId } = req.body || {};
    if (!name || collegeId == null) return res.status(400).json({ error: 'name and collegeId are required' });
    if (leaderId == null || leaderId === '') return res.status(400).json({ error: 'leaderId is required. Each community must have a supervisor.' });
    const leaderIdNum = Number(leaderId);
    if (Number.isNaN(leaderIdNum)) return res.status(400).json({ error: 'Invalid leaderId' });
    const userCheck = await pool.query('SELECT id, role FROM app_users WHERE id = $1', [leaderIdNum]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Leader user not found' });
    const role = userCheck.rows[0].role;
    if (role !== 'supervisor' && role !== 'community_leader') return res.status(400).json({ error: 'Leader must have role supervisor or community_leader' });
    const r = await pool.query(
      'INSERT INTO communities (name, college_id) VALUES ($1, $2) RETURNING id, name, college_id AS "collegeId"',
      [String(name).trim(), Number(collegeId)]
    );
    const newId = r.rows[0].id;
    await pool.query('UPDATE app_users SET community_id = $1 WHERE id = $2', [newId, leaderIdNum]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid college' });
    if (err?.code === '23505') return res.status(409).json({ error: 'A community with this name already exists in this college' });
    console.error('communities create error:', err);
    res.status(500).json({ error: 'Failed to create community' });
  }
});

/** PATCH /api/communities/:id — admin: any community; dean: only communities of their college. Body: { name }. */
app.patch('/api/communities/:id', optionalAuth, requireAuth, async (req, res) => {
  try {
    const communityId = Number(req.params.id);
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const existing = await pool.query(
      'SELECT c.id, c.name, c.college_id FROM communities c WHERE c.id = $1',
      [communityId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
    const row = existing.rows[0];
    const isAdmin = isAdminRole(req.user.role);
    const isDean = isDeanRole(req.user.role);
    const isCommunityLeader = isCommunityLeaderRole(req.user.role);
    if (!isAdmin && !isDean && !isCommunityLeader) return res.status(403).json({ error: 'Only admin, dean, or community leader can edit communities' });
    if (isDean && !isAdmin) {
      if (req.user.college_id == null || Number(row.college_id) !== Number(req.user.college_id)) {
        return res.status(403).json({ error: 'You can only edit communities of your college' });
      }
    }
    if (isCommunityLeader && !isAdmin) {
      if (req.user.community_id == null || Number(row.id) !== Number(req.user.community_id)) {
        return res.status(403).json({ error: 'You can only edit the community you lead' });
      }
    }
    const r = await pool.query(
      'UPDATE communities SET name = $1 WHERE id = $2 RETURNING id, name, college_id AS "collegeId"',
      [String(name).trim(), communityId]
    );
    const updated = r.rows[0];
    const collegeName = (await pool.query('SELECT name FROM colleges WHERE id = $1', [updated.collegeId])).rows[0]?.name;
    res.json({ ...updated, collegeName });
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'A community with this name already exists in this college' });
    console.error('communities update error:', err);
    res.status(500).json({ error: 'Failed to update community' });
  }
});

/** GET /api/majors?collegeId= (optional) */
app.get('/api/majors', async (req, res) => {
  try {
    const collegeId = req.query.collegeId;
    const q = collegeId
      ? 'SELECT id, name, college_id AS "collegeId" FROM majors WHERE college_id = $1 ORDER BY name'
      : 'SELECT id, name, college_id AS "collegeId" FROM majors ORDER BY college_id, name';
    const r = collegeId ? await pool.query(q, [collegeId]) : await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error('majors list error:', err);
    res.status(500).json({ error: 'Failed to load majors' });
  }
});

/** GET /api/majors/:id — single major by id (for MajorDetails page). */
async function getMajorById(req, res) {
  try {
    const id = req.params.id;
    const r = await pool.query(
      'SELECT m.id, m.name, m.college_id AS "collegeId", c.name AS "collegeName", c.name AS "college_short_name" FROM majors m LEFT JOIN colleges c ON c.id = m.college_id WHERE m.id = $1',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Major not found' });
    const row = r.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      college_id: row.collegeId,
      college_name: row.collegeName,
      college_short_name: row.college_short_name,
      required_gpa: null,
      high_school_track: null,
      degree_type: null,
      duration: null,
      description: null,
      about_text: null,
      image_url: null,
    });
  } catch (err) {
    console.error('major get error:', err);
    res.status(500).json({ error: 'Failed to load major' });
  }
}
app.get('/api/majors/:id', getMajorById);
/** GET /api/programs/:id — alias for MajorDetails page. */
app.get('/api/programs/:id', getMajorById);

const EVENTS_SELECT = `SELECT e.id, e.title, e.description, e.category, e.image, e.club_name AS "clubName", e.location,
  e.start_date AS "startDate", e.start_time AS "startTime", e.end_date AS "endDate", e.end_time AS "endTime",
  e.available_seats AS "availableSeats", e.price, e.price_member AS "priceMember", e.featured, e.status, e.feedback,
  e.approval_step AS "approvalStep", e.custom_sections AS "customSections", e.created_at AS "createdAt",
  e.community_id AS "communityId", c.name AS "communityName", col.id AS "collegeId", col.name AS "collegeName",
  COALESCE(e.for_all_colleges, true) AS "forAllColleges",
  COALESCE(e.target_college_ids, '[]'::jsonb) AS "targetCollegeIds",
  COALESCE(e.target_all_majors, true) AS "targetAllMajors",
  COALESCE(e.target_major_ids, '[]'::jsonb) AS "targetMajorIds"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** GET /api/events — public list (approved + seed upcoming/past). Optional ?status=approved. */
app.get('/api/events', optionalAuth, async (req, res) => {
  try {
    const status = req.query.status;
    let q = EVENTS_SELECT + ' WHERE 1=1';
    const params = [];
    if (status) {
      params.push(status);
      q += ` AND e.status = $${params.length}`;
    } else {
      q += " AND (e.status IN ('approved', 'upcoming', 'past') OR e.status IS NULL)";
    }
    q += ' ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('events list error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

/** GET /api/events/:id — includes resolved audience names (targetCollegeNames, targetMajorNames) for display. */
app.get('/api/events/:id', optionalAuth, async (req, res) => {
  try {
    const r = await pool.query(EVENTS_SELECT + ' WHERE e.id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const row = r.rows[0];
    const rawCollegeIds = Array.isArray(row.targetCollegeIds) ? row.targetCollegeIds : (row.targetCollegeIds ? JSON.parse(JSON.stringify(row.targetCollegeIds)) : []);
    const rawMajorIds = Array.isArray(row.targetMajorIds) ? row.targetMajorIds : (row.targetMajorIds ? JSON.parse(JSON.stringify(row.targetMajorIds)) : []);
    const collegeIds = rawCollegeIds.map((id) => (typeof id === 'number' ? id : parseInt(id, 10))).filter((n) => !Number.isNaN(n));
    const majorIds = rawMajorIds.map((id) => (typeof id === 'number' ? id : parseInt(id, 10))).filter((n) => !Number.isNaN(n));
    if (collegeIds.length > 0) {
      const cr = await pool.query('SELECT id, name FROM colleges WHERE id = ANY($1::int[]) ORDER BY name', [collegeIds]);
      row.targetCollegeNames = cr.rows.map((c) => c.name);
    } else {
      row.targetCollegeNames = [];
    }
    if (majorIds.length > 0) {
      const mr = await pool.query('SELECT id, name FROM majors WHERE id = ANY($1::int[]) ORDER BY name', [majorIds]);
      row.targetMajorNames = mr.rows.map((m) => m.name);
    } else {
      row.targetMajorNames = [];
    }
    res.json(row);
  } catch (err) {
    console.error('event get error:', err);
    res.status(500).json({ error: 'Failed to load event' });
  }
});

// ——— Admin-only routes (requireAdmin): add any new admin feature here and use requireAdmin ———
// POST /api/events, PUT /api/events/:id, PATCH /api/events/:id/approve, PATCH /api/events/:id/reject,
// DELETE /api/events/:id, GET /api/admin/events
/** POST /api/events — admin or community leader. Admin: any communityId; leader: only their community. */
app.post('/api/events', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    const isDean = isDeanRole(user?.role);
    if (!isAdmin && !isLeader && !isDean) {
      return res.status(403).json({ error: 'Only admin, dean, or community leader can create events' });
    }
    const b = req.body || {};
    const validationError = validateRequiredEventFields(b);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (b.communityId == null) return res.status(400).json({ error: 'communityId is required. Each event must be connected to a community.' });
    let communityId = Number(b.communityId);
    const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
    const community = cr.rows[0];
    if (!community) {
      return res.status(400).json({ error: 'Community not found' });
    }
    if (isLeader && !isAdmin) {
      if (communityId !== Number(user.community_id)) {
        return res.status(403).json({ error: 'You can add events only for your community' });
      }
    }
    if (isDean && !isAdmin) {
      if (user.college_id == null || Number(community.college_id) !== Number(user.college_id)) {
        return res.status(403).json({ error: 'You can add events only for communities in your college' });
      }
    }
    let clubName = b.clubName || 'University';
    // For community leader / supervisor / dean, always use the community name for club/association
    if ((isLeader || isDean) && !isAdmin && community.name) {
      clubName = community.name;
    }
    const forAllColleges = b.forAllColleges !== false;
    const targetCollegeIds = Array.isArray(b.targetCollegeIds) ? b.targetCollegeIds : [];
    const targetAllMajors = b.targetAllMajors !== false;
    const targetMajorIds = Array.isArray(b.targetMajorIds) ? b.targetMajorIds : [];
    if (!forAllColleges && targetCollegeIds.length === 0) {
      return res.status(400).json({ error: 'When event is for specific colleges, at least one college must be selected.' });
    }
    if (!forAllColleges && !targetAllMajors && targetMajorIds.length === 0) {
      return res.status(400).json({ error: 'When event is for specific majors, at least one major must be selected.' });
    }
    const id = b.id || `ev-${Date.now()}`;
    await pool.query(
      `INSERT INTO events (id, title, description, category, image, club_name, location, start_date, start_time, end_date, end_time, available_seats, price, price_member, featured, status, feedback, approval_step, custom_sections, community_id, for_all_colleges, target_college_ids, target_all_majors, target_major_ids, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW())`,
      [
        id,
        b.title || '',
        b.description || '',
        b.category || 'Event',
        b.image || '/event1.jpg',
        clubName,
        b.location || '',
        b.startDate || null,
        b.startTime || null,
        b.endDate || null,
        b.endTime || null,
        b.availableSeats ?? 0,
        b.price ?? 0,
        b.priceMember ?? null,
        Boolean(b.featured),
        b.status || 'pending',
        b.feedback || null,
        b.approvalStep ?? 0,
        JSON.stringify(b.customSections || []),
        communityId,
        forAllColleges,
        JSON.stringify(targetCollegeIds),
        targetAllMajors,
        JSON.stringify(targetMajorIds),
        req.user.id,
      ]
    );
    const r = await pool.query('SELECT id, title, status, start_date AS "startDate", start_time AS "startTime", created_at AS "createdAt", created_by AS "createdBy" FROM events WHERE id = $1', [id]);
    const created = r.rows[0];
    if (created?.createdBy) {
      await createNotification(
        created.createdBy,
        'Event submitted for approval',
        `Your event "${created.title || created.id}" has been submitted and is pending approval.`
      );
    }
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid community. Each event must be connected to an existing community.' });
    console.error('event create error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', optionalAuth, requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    const isDean = isDeanRole(user?.role);
    if (!isAdmin && !isLeader && !isDean) {
      return res.status(403).json({ error: 'Only admin, dean, or community leader can edit events' });
    }
    const existing = await pool.query('SELECT id, community_id FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (isLeader && !isAdmin) {
      if (Number(existing.rows[0].community_id) !== Number(user.community_id)) return res.status(403).json({ error: 'You can edit only events of your community' });
    }
    const b = req.body || {};
    const validationError = validateRequiredEventFields(b);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (b.communityId == null) return res.status(400).json({ error: 'communityId is required. Each event must be connected to a community.' });
    const communityId = Number(b.communityId);
    const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
    const community = cr.rows[0];
    if (!community) {
      return res.status(400).json({ error: 'Community not found' });
    }
    if (isLeader && !isAdmin && communityId !== Number(user.community_id)) {
      return res.status(403).json({ error: 'You can assign events only to your community' });
    }
    if (isDean && !isAdmin) {
      if (user.college_id == null || Number(community.college_id) !== Number(user.college_id)) {
        return res.status(403).json({ error: 'You can assign events only to communities in your college' });
      }
    }
    let clubName = b.clubName ?? 'University';
    // For community leader / supervisor / dean, keep club name in sync with their community
    if ((isLeader || isDean) && !isAdmin && community.name) {
      clubName = community.name;
    }
    const forAllColleges = b.forAllColleges !== false;
    const targetCollegeIds = Array.isArray(b.targetCollegeIds) ? b.targetCollegeIds : [];
    const targetAllMajors = b.targetAllMajors !== false;
    const targetMajorIds = Array.isArray(b.targetMajorIds) ? b.targetMajorIds : [];
    if (!forAllColleges && targetCollegeIds.length === 0) {
      return res.status(400).json({ error: 'When event is for specific colleges, at least one college must be selected.' });
    }
    if (!forAllColleges && !targetAllMajors && targetMajorIds.length === 0) {
      return res.status(400).json({ error: 'When event is for specific majors, at least one major must be selected.' });
    }
    await pool.query(
      `UPDATE events SET title=$2, description=$3, category=$4, image=$5, club_name=$6, location=$7, start_date=$8, start_time=$9, end_date=$10, end_time=$11, available_seats=$12, price=$13, price_member=$14, featured=$15, status=$16, feedback=$17, approval_step=$18, custom_sections=$19, community_id=$20, for_all_colleges=$21, target_college_ids=$22, target_all_majors=$23, target_major_ids=$24, updated_at=NOW() WHERE id=$1`,
      [
        id,
        b.title ?? '',
        b.description ?? '',
        b.category ?? 'Event',
        b.image ?? '/event1.jpg',
        clubName,
        b.location ?? '',
        b.startDate || null,
        b.startTime || null,
        b.endDate || null,
        b.endTime || null,
        b.availableSeats ?? 0,
        b.price ?? 0,
        b.priceMember ?? null,
        Boolean(b.featured),
        b.status ?? 'draft',
        b.feedback ?? null,
        b.approvalStep ?? 0,
        JSON.stringify(b.customSections || []),
        communityId,
        forAllColleges,
        JSON.stringify(targetCollegeIds),
        targetAllMajors,
        JSON.stringify(targetMajorIds),
      ]
    );
    const r = await pool.query('SELECT id, title, status, start_date AS "startDate", start_time AS "startTime" FROM events WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid community. Each event must be connected to an existing community.' });
    console.error('event update error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * PATCH /api/events/:id/approve
 *
 * Multi-step approval workflow:
 *  - Step 0 → 1: Supervisor of the event's community (or admin) approves.
 *  - Step 1 → 2: Dean of the event's college (or admin) approves.
 *  - Step 2 → 3: Admin gives final approval; status becomes 'approved'.
 *
 * Community leader creates the event (approval_step starts at 0 via create/update).
 */
app.patch('/api/events/:id/approve', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isSupervisor = isSupervisorRole(user?.role);
    const isDean = isDeanRole(user?.role);

    // Load event with its community/college for role-based checks
    const er = await pool.query(
      `SELECT e.id, e.status, COALESCE(e.approval_step, 0) AS approval_step,
              e.community_id,
              c.college_id AS college_id
       FROM events e
       LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (er.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = er.rows[0];
    const currentStep = Number(event.approval_step) || 0;

    if (event.status === 'rejected') {
      return res.status(400).json({ error: 'Cannot approve a rejected event' });
    }

    let nextStep = currentStep;
    let newStatus = event.status;

    if (currentStep === 0) {
      // Supervisor (of this community) or admin
      const isCommunitySupervisor =
        isSupervisor &&
        user?.community_id != null &&
        event.community_id != null &&
        Number(user.community_id) === Number(event.community_id);
      if (!isAdmin && !isCommunitySupervisor) {
        return res.status(403).json({ error: 'Only the supervisor of this community or an admin can approve at this step' });
      }
      nextStep = 1;
      // keep status as pending until final approval
    } else if (currentStep === 1) {
      // Dean (of this college) or admin
      const isCollegeDean =
        isDean &&
        user?.college_id != null &&
        event.college_id != null &&
        Number(user.college_id) === Number(event.college_id);
      if (!isAdmin && !isCollegeDean) {
        return res.status(403).json({ error: 'Only the dean of this college or an admin can approve at this step' });
      }
      nextStep = 2;
    } else if (currentStep === 2) {
      // Final approval by admin only
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admin can give final approval' });
      }
      nextStep = 3;
      newStatus = 'approved';
    } else {
      // Already fully approved
      return res.status(400).json({ error: 'Event is already fully approved' });
    }

    // Persist changes
    if (newStatus && newStatus !== event.status) {
      await pool.query(
        'UPDATE events SET approval_step = $2, status = $3, updated_at = NOW() WHERE id = $1',
        [event.id, nextStep, newStatus]
      );
    } else {
      await pool.query(
        'UPDATE events SET approval_step = $2, updated_at = NOW() WHERE id = $1',
        [event.id, nextStep]
      );
    }

    const r = await pool.query(
      'SELECT id, title, status, COALESCE(approval_step, 0) AS "approvalStep", created_by AS "createdBy" FROM events WHERE id = $1',
      [event.id]
    );
    const updated = r.rows[0];
    if (updated?.createdBy && newStatus === 'approved') {
      await createNotification(
        updated.createdBy,
        'Event approved',
        `Your event "${updated.title || updated.id}" has been fully approved and published.`
      );
    }
    res.json(updated);
  } catch (err) {
    console.error('event approve error:', err);
    res.status(500).json({ error: 'Failed to approve event' });
  }
});

/**
 * PATCH /api/events/:id/reject
 *
 * Any reviewer in the chain (supervisor, dean, admin) can reject and add feedback
 * to send the event back to the creator for changes.
 */
app.patch('/api/events/:id/reject', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isSupervisor = isSupervisorRole(user?.role);
    const isDean = isDeanRole(user?.role);
    const feedback = (req.body || {}).feedback || null;

    // Load event with community/college for permission checks
    const er = await pool.query(
      `SELECT e.id, e.status, COALESCE(e.approval_step, 0) AS approval_step,
              e.community_id,
              c.college_id AS college_id
       FROM events e
       LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (er.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = er.rows[0];

    // Determine if this reviewer is allowed to reject at the current step
    const step = Number(event.approval_step) || 0;
    let allowed = false;
    if (isAdmin) {
      allowed = true;
    } else if (step === 0 && isSupervisor && user?.community_id != null && event.community_id != null) {
      // Supervisor of this community reviewing step 0
      allowed = Number(user.community_id) === Number(event.community_id);
    } else if (step === 1 && isDean && user?.college_id != null && event.college_id != null) {
      // Dean of this college reviewing step 1
      allowed = Number(user.college_id) === Number(event.college_id);
    } else if (step >= 2) {
      // From step 2 onwards, only admin should reject (final stages)
      allowed = false;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'You are not allowed to reject this event at its current step' });
    }

    // When someone asks for changes, reset the flow:
    // - status back to 'pending'
    // - approval_step back to 0 (community leader / creator starts again)
    await pool.query(
      'UPDATE events SET status = $2, approval_step = 0, feedback = $3, updated_at = NOW() WHERE id = $1',
      [event.id, 'pending', feedback]
    );
    const r = await pool.query(
      'SELECT id, status, COALESCE(approval_step, 0) AS "approvalStep", feedback FROM events WHERE id = $1',
      [event.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('event reject error:', err);
    res.status(500).json({ error: 'Failed to reject event' });
  }
});

app.delete('/api/events/:id', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) return res.status(403).json({ error: 'Only admin or community leader can delete events' });
    const existing = await pool.query('SELECT id, community_id FROM events WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (isLeader && !isAdmin) {
      if (Number(existing.rows[0].community_id) !== Number(user.community_id)) return res.status(403).json({ error: 'You can delete only events of your community' });
    }
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('event delete error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/** GET /api/event-registrations — current user's registrations. */
app.get('/api/event-registrations', optionalAuth, requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT er.id, er.event_id AS "eventId", er.student_id AS "studentId", er.college, er.major,
       er.status, er.paid_at AS "paidAt", er.created_at AS "createdAt",
       e.title, e.start_date AS "date", e.start_time AS "time", e.image, e.location
       FROM event_registrations er
       LEFT JOIN events e ON e.id = er.event_id
       WHERE er.user_id = $1 ORDER BY er.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('registrations list error:', err);
    res.status(500).json({ error: 'Failed to load registrations' });
  }
});

/** Check if a student (by college and major names) can join an event based on event audience (colleges/majors). */
async function canStudentJoinEvent(pool, eventRow, collegeName, majorName) {
  const forAllColleges = eventRow.for_all_colleges !== false;
  if (forAllColleges) return true;
  const targetCollegeIds = Array.isArray(eventRow.target_college_ids) ? eventRow.target_college_ids : (eventRow.target_college_ids ? JSON.parse(JSON.stringify(eventRow.target_college_ids)) : []);
  if (targetCollegeIds.length === 0) return true;
  const collegeTrim = typeof collegeName === 'string' ? collegeName.trim() : '';
  const majorTrim = typeof majorName === 'string' ? majorName.trim() : '';
  if (!collegeTrim) return false;
  const colRow = await pool.query('SELECT id FROM colleges WHERE TRIM(name) = $1 LIMIT 1', [collegeTrim]);
  const collegeId = colRow.rows[0]?.id != null ? Number(colRow.rows[0].id) : null;
  if (collegeId == null) return false;
  const collegeAllowed = targetCollegeIds.some((id) => Number(id) === collegeId);
  if (!collegeAllowed) return false;
  const targetAllMajors = eventRow.target_all_majors !== false;
  if (targetAllMajors) return true;
  const targetMajorIds = Array.isArray(eventRow.target_major_ids) ? eventRow.target_major_ids : (eventRow.target_major_ids ? JSON.parse(JSON.stringify(eventRow.target_major_ids)) : []);
  if (targetMajorIds.length === 0) return true;
  if (!majorTrim) return false;
  const majRow = await pool.query('SELECT id FROM majors WHERE TRIM(name) = $1 AND college_id = $2 LIMIT 1', [majorTrim, collegeId]);
  const majorId = majRow.rows[0]?.id != null ? Number(majRow.rows[0].id) : null;
  if (majorId == null) return false;
  return targetMajorIds.some((id) => Number(id) === majorId);
}

/** POST /api/event-registrations — register for an event (status starts as pending; community leader/supervisor approves). */
app.post('/api/event-registrations', optionalAuth, requireAuth, async (req, res) => {
  try {
    const { eventId, associationMember } = req.body || {};
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    // Ensure event exists and is visible for registration (approved / upcoming / past). Include audience columns.
    const ev = await pool.query(
      `SELECT id, status, community_id, title, COALESCE(for_all_colleges, true) AS for_all_colleges,
       COALESCE(target_college_ids, '[]'::jsonb) AS target_college_ids,
       COALESCE(target_all_majors, true) AS target_all_majors,
       COALESCE(target_major_ids, '[]'::jsonb) AS target_major_ids
       FROM events WHERE id = $1`,
      [eventId]
    );
    if (ev.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const eventRow = ev.rows[0];
    const eventStatus = eventRow.status || 'draft';
    if (eventStatus === 'draft' || eventStatus === 'pending' || eventStatus === 'rejected') {
      return res.status(400).json({ error: 'You cannot register for this event yet.' });
    }

    // Always take student information from the authenticated user's profile / account,
    // not from the client payload.
    const ur = await pool.query(
      `SELECT u.first_name, u.middle_name, u.last_name, u.student_number, u.email,
              u.college, u.major,
              sp.college AS profile_college, sp.major AS profile_major
       FROM app_users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (ur.rows.length === 0) {
      return res.status(400).json({ error: 'User profile not found for registration' });
    }
    const row = ur.rows[0];
    const studentId = row.student_number || null;
    const college = row.college || row.profile_college || null;
    const major = row.major || row.profile_major || null;
    const baseNameParts = [row.first_name, row.middle_name, row.last_name].filter(Boolean);
    const name =
      (baseNameParts.length ? baseNameParts.join(' ') : null) ||
      (row.email ? (row.email.split('@')[0] || row.email) : null);
    const email = row.email || req.user.email;

    const canJoin = await canStudentJoinEvent(pool, eventRow, college, major);
    if (!canJoin) {
      return res.status(403).json({
        error: 'This event is only open to students from specific colleges or majors. Your profile does not match the event audience.',
      });
    }

    await pool.query(
      `INSERT INTO event_registrations (user_id, event_id, student_id, college, major, association_member, name, email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment')
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [req.user.id, eventId, studentId || null, college || null, major || null, associationMember || 'non-member', name || null, email || null]
    );
    const r = await pool.query(
      'SELECT id, event_id AS "eventId", status, created_at AS "createdAt" FROM event_registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, eventId]
    );
    // Notify community leader/supervisor that a new registration is pending payment
    if (eventRow.community_id != null) {
      const lr = await pool.query(
        "SELECT id FROM app_users WHERE community_id = $1 AND role IN ('supervisor','community_leader') LIMIT 1",
        [eventRow.community_id]
      );
      const leader = lr.rows[0];
      if (leader?.id) {
        await createNotification(
          leader.id,
          'New event registration (pending payment)',
          `A new student requested to join your event "${eventRow.title || eventId}". After they pay, you can approve.`
        );
      }
    }
    // Notify student: pending payment, then community will approve
    await createNotification(
      req.user.id,
      'Registration pending payment',
      `Your request to join the event "${eventRow.title || eventId}" is pending payment. After you pay, the community will approve your spot (first paid, first approved until event is full).`
    );
    res.status(201).json(r.rows[0] || { registered: true });
  } catch (err) {
    if (err?.code === '23503') return res.status(404).json({ error: 'Event not found' });
    console.error('registration create error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

/** GET /api/community/event-registrations — registrations for events of the leader's community. Only supervisor/community_leader (or admin) can view. */
app.get('/api/community/event-registrations', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) {
      return res.status(403).json({ error: 'Only admin or community leader/supervisor can view registrations for their community' });
    }
    const status = req.query.status || null;
    const params = [];
    let where = 'WHERE 1=1';
    if (isLeader && !isAdmin) {
      params.push(user.community_id);
      where += ` AND e.community_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND er.status = $${params.length}`;
    }
    const q = `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.student_id AS "studentId",
                      er.college, er.major, er.association_member AS "associationMember",
                      er.status, er.paid_at AS "paidAt", er.created_at AS "createdAt",
                      e.title, e.start_date AS "date", e.start_time AS "time", e.location,
                      e.available_seats AS "availableSeats",
                      u.email AS "studentEmail"
               FROM event_registrations er
               JOIN events e ON e.id = er.event_id
               JOIN app_users u ON u.id = er.user_id
               ${where}
               ORDER BY er.paid_at ASC NULLS LAST, er.created_at ASC`;
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('community registrations list error:', err);
    res.status(500).json({ error: 'Failed to load registrations' });
  }
});

/** PATCH /api/event-registrations/:id/mark-paid — community leader/supervisor (or admin) marks registration as paid. After payment, leader can approve (subject to capacity). */
app.patch('/api/event-registrations/:id/mark-paid', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) {
      return res.status(403).json({ error: 'Only community leader, supervisor, or admin can mark registrations as paid' });
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid registration id' });
    const rr = await pool.query(
      `SELECT er.id, er.status, e.id AS event_id, e.community_id, e.title
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [id]
    );
    if (rr.rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
    const row = rr.rows[0];
    if (!isAdmin && (row.community_id == null || Number(row.community_id) !== Number(user.community_id))) {
      return res.status(403).json({ error: 'You can only mark paid for registrations of your community events' });
    }
    if (row.status !== 'pending_payment' && row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payment registrations can be marked as paid' });
    }
    await pool.query(
      'UPDATE event_registrations SET status = $1, paid_at = NOW(), decided_by = NULL, decided_at = NULL WHERE id = $2',
      ['paid', id]
    );
    const regUser = await pool.query('SELECT user_id FROM event_registrations WHERE id = $1', [id]);
    if (regUser.rows[0]?.user_id) {
      await createNotification(
        regUser.rows[0].user_id,
        'Payment recorded',
        `Your payment for the event "${row.title || row.event_id}" has been recorded. The community will approve your spot (first paid, first approved until the event is full).`
      );
    }
    const r = await pool.query(
      `SELECT er.id, er.event_id AS "eventId", er.status, er.paid_at AS "paidAt"
       FROM event_registrations er WHERE er.id = $1`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('registration mark-paid error:', err);
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
});

/** PATCH /api/event-registrations/:id/approve — only supervisor/community_leader of the event's community can approve. Registration must be paid first. Approve only until event capacity. */
app.patch('/api/event-registrations/:id/approve', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) {
      return res.status(403).json({ error: 'Only community leader or supervisor can approve registrations' });
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid registration id' });
    const rr = await pool.query(
      `SELECT er.id, er.status, e.id AS event_id, e.community_id, e.available_seats
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [id]
    );
    if (rr.rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
    const row = rr.rows[0];
    if (!isAdmin && (row.community_id == null || Number(row.community_id) !== Number(user.community_id))) {
      return res.status(403).json({ error: 'You can only approve registrations for events of your community' });
    }
    if (row.status === 'approved') {
      return res.json({ id: row.id, status: 'approved' });
    }
    if (row.status !== 'paid' && row.status !== 'pending') {
      return res.status(400).json({ error: 'Only paid registrations can be approved. Mark the registration as paid first.' });
    }
    const capacity = row.available_seats != null ? Number(row.available_seats) : 0;
    if (capacity > 0) {
      const countResult = await pool.query(
        'SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = $1 AND status = $2',
        [row.event_id, 'approved']
      );
      const approvedCount = parseInt(countResult.rows[0]?.cnt || '0', 10);
      if (approvedCount >= capacity) {
        return res.status(400).json({ error: 'Event is full. No more spots available.' });
      }
    }
    await pool.query(
      'UPDATE event_registrations SET status = $1, decided_by = $2, decided_at = NOW() WHERE id = $3',
      ['approved', user.id, id]
    );
    const r = await pool.query(
      `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.status,
              er.decided_by AS "decidedBy", er.decided_at AS "decidedAt",
              e.title
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [id]
    );
    const row2 = r.rows[0];
    if (row2?.userId) {
      await createNotification(
        row2.userId,
        'Registration approved',
        `Your registration for the event "${row2.title || row2.eventId}" has been approved.`
      );
    }
    res.json(row2);
  } catch (err) {
    console.error('registration approve error:', err);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

/** PATCH /api/event-registrations/:id/reject — only supervisor/community_leader of the event's community (or admin) can reject. */
app.patch('/api/event-registrations/:id/reject', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) {
      return res.status(403).json({ error: 'Only community leader or supervisor can reject registrations' });
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid registration id' });
    const rr = await pool.query(
      `SELECT er.id, er.status, e.id AS event_id, e.community_id
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [id]
    );
    if (rr.rows.length === 0) return res.status(404).json({ error: 'Registration not found' });
    const row = rr.rows[0];
    if (!isAdmin && (row.community_id == null || Number(row.community_id) !== Number(user.community_id))) {
      return res.status(403).json({ error: 'You can only reject registrations for events of your community' });
    }
    if (row.status === 'rejected') {
      return res.json({ id: row.id, status: 'rejected' });
    }
    await pool.query(
      'UPDATE event_registrations SET status = $1, decided_by = $2, decided_at = NOW() WHERE id = $3',
      ['rejected', user.id, id]
    );
    const r = await pool.query(
      `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.status,
              er.decided_by AS "decidedBy", er.decided_at AS "decidedAt",
              e.title
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [id]
    );
    const row2 = r.rows[0];
    if (row2?.userId) {
      await createNotification(
        row2.userId,
        'Registration rejected',
        `Your registration for the event "${row2.title || row2.eventId}" has been rejected.`
      );
    }
    res.json(row2);
  } catch (err) {
    console.error('registration reject error:', err);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

/** GET /api/student-profile — current user's profile. */
app.get('/api/student-profile', optionalAuth, requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT college, major, gpa, credits_earned AS "creditsEarned", credits_total AS "creditsTotal", picture FROM student_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0) return res.json({});
    res.json(r.rows[0]);
  } catch (err) {
    console.error('profile get error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/** PUT /api/student-profile — upsert current user's profile. */
app.put('/api/student-profile', optionalAuth, requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    await pool.query(
      `INSERT INTO student_profiles (user_id, college, major, gpa, credits_earned, credits_total, picture, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         college=COALESCE(EXCLUDED.college, student_profiles.college),
         major=COALESCE(EXCLUDED.major, student_profiles.major),
         gpa=COALESCE(EXCLUDED.gpa, student_profiles.gpa),
         credits_earned=COALESCE(EXCLUDED.credits_earned, student_profiles.credits_earned),
         credits_total=COALESCE(EXCLUDED.credits_total, student_profiles.credits_total),
         picture=COALESCE(EXCLUDED.picture, student_profiles.picture),
         updated_at=NOW()`,
      [req.user.id, b.college || null, b.major || null, b.gpa ?? null, b.creditsEarned ?? null, b.creditsTotal ?? null, b.picture || null]
    );
    const r = await pool.query('SELECT college, major, gpa, credits_earned AS "creditsEarned", credits_total AS "creditsTotal", picture FROM student_profiles WHERE user_id = $1', [req.user.id]);
    res.json(r.rows[0] || {});
  } catch (err) {
    console.error('profile put error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/** GET /api/notifications — current user's notifications. */
app.get('/api/notifications', optionalAuth, requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, title, message, read, created_at AS "createdAt" FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('notifications list error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/** PATCH /api/notifications/:id/read */
app.patch('/api/notifications/:id/read', optionalAuth, requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/** POST /api/notifications — create (e.g. welcome); ensure one welcome per user. */
app.post('/api/notifications', optionalAuth, requireAuth, async (req, res) => {
  try {
    const { title, message } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    const existing = await pool.query("SELECT 1 FROM notifications WHERE user_id = $1 AND title = 'Welcome' LIMIT 1", [req.user.id]);
    if (existing.rows.length > 0) return res.json({ created: false });
    const r = await pool.query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1,$2,$3) RETURNING id, title, message, read, created_at AS "createdAt"',
      [req.user.id, title || 'Welcome', message || '']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('notification create error:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/** GET /api/admin/events — admin: all events; dean: events of their college; community leader / supervisor: only events of their community. */
app.get('/api/admin/events', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isDean = isDeanRole(user?.role) && user?.college_id != null;
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isDean && !isLeader) return res.status(403).json({ error: 'Only admin, dean, or community leader can list manageable events' });
    let q = EVENTS_SELECT + ' WHERE 1=1';
    const params = [];
    if (isLeader && !isAdmin) {
      params.push(user.community_id);
      q += ` AND e.community_id = $${params.length}`;
    } else if (isDean && !isAdmin) {
      params.push(user.college_id);
      q += ` AND c.college_id = $${params.length}`;
    }
    q += ' ORDER BY e.created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('admin events error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

/** GET /api/admin/users — admin: all users; dean: only users in their college. Community leader cannot see any users. Optional ?role= filter. */
app.get('/api/admin/users', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isDean = isDeanRole(user?.role);
    if (!isAdmin && !isDean) return res.status(403).json({ error: 'Only admin or dean can list users. Community leaders cannot view or edit user information.' });

    const roleFilter = req.query.role;
    const baseSelect = 'SELECT u.id, u.email, u.role, u.college_id AS "collegeId", u.community_id AS "communityId", u.college AS "collegeText", c.name AS "collegeName", co.name AS "communityName" FROM app_users u LEFT JOIN colleges c ON c.id = u.college_id LEFT JOIN communities co ON co.id = u.community_id';
    let q = baseSelect + ' WHERE 1=1';
    const params = [];

    if (isDean && !isAdmin && user?.college_id != null) {
      params.push(user.college_id);
      q += ` AND (u.college_id = $${params.length} OR u.community_id IN (SELECT id FROM communities WHERE college_id = $${params.length}) OR (u.role = 'student' AND TRIM(COALESCE(u.college, '')) = (SELECT TRIM(name) FROM colleges WHERE id = $${params.length})))`;
    }
    if (roleFilter) {
      params.push(roleFilter);
      q += ` AND u.role = $${params.length}`;
    }
    q += ' ORDER BY u.role, u.email';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('admin users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/** PATCH /api/admin/users/:id — admin or dean: update user role and assignments. Body: { role, collegeId?, communityId? }.
 *  Admin can change any user to any role (admin, dean, supervisor, community_leader, student); when setting dean
 *  collegeId is required; when setting supervisor or community_leader communityId is required. Dean can only edit
 *  users in their college (student ↔ supervisor or community_leader) and cannot set role to admin. Community leaders cannot call this. */
app.patch('/api/admin/users/:id', optionalAuth, requireAuth, async (req, res) => {
  try {
    const editor = req.user;
    const isAdmin = isAdminRole(editor?.role);
    const isDean = isDeanRole(editor?.role);
    if (!isAdmin && !isDean) return res.status(403).json({ error: 'Only admin or dean can edit users. Community leaders cannot view or edit user information.' });

    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    const body = req.body || {};
    const newRole = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';

    const validRoles = ['admin', 'dean', 'supervisor', 'community_leader', 'student', 'user'];
    if (!newRole || !validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'role is required and must be one of: admin, dean, supervisor, community_leader, student' });
    }
    if (isDean && newRole === 'admin') return res.status(403).json({ error: 'Only an admin can assign the admin role.' });

    const target = await pool.query(
      'SELECT u.id, u.role, u.college_id, u.community_id, u.college AS college_text, c.name AS college_name FROM app_users u LEFT JOIN colleges c ON c.id = u.college_id WHERE u.id = $1',
      [userId]
    );
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = target.rows[0];

    if (isDean && !isAdmin) {
      const deanCollegeId = editor.college_id;
      if (deanCollegeId == null) return res.status(403).json({ error: 'You must be assigned to a college to edit users.' });
      const deanCollegeName = (await pool.query('SELECT name FROM colleges WHERE id = $1', [deanCollegeId])).rows[0]?.name || '';
      const targetInCollege =
        Number(targetUser.college_id) === Number(deanCollegeId) ||
        (targetUser.community_id != null && (await pool.query('SELECT 1 FROM communities WHERE id = $1 AND college_id = $2', [targetUser.community_id, deanCollegeId])).rows.length > 0) ||
        (targetUser.role === 'student' && targetUser.college_text != null && String(targetUser.college_text).trim() === String(deanCollegeName).trim());
      if (!targetInCollege) return res.status(403).json({ error: 'You can only edit users in your college.' });
    }

    let newCollegeId = null;
    let newCommunityId = null;

    if (newRole === 'dean') {
      if (!isAdmin) return res.status(403).json({ error: 'Only admin can assign the dean role.' });
      const collegeIdNum = body.collegeId != null ? Number(body.collegeId) : NaN;
      if (Number.isNaN(collegeIdNum)) return res.status(400).json({ error: 'collegeId is required when setting role to dean' });
      newCollegeId = collegeIdNum;
      newCommunityId = null;
    } else if (newRole === 'supervisor' || newRole === 'community_leader') {
      const communityIdNum = body.communityId != null ? Number(body.communityId) : NaN;
      if (Number.isNaN(communityIdNum)) return res.status(400).json({ error: 'communityId is required when setting role to supervisor or community_leader' });
      const comm = await pool.query('SELECT id, college_id FROM communities WHERE id = $1', [communityIdNum]);
      if (comm.rows.length === 0) return res.status(400).json({ error: 'Community not found' });
      if (isDean && !isAdmin && Number(comm.rows[0].college_id) !== Number(editor.college_id)) {
        return res.status(403).json({ error: 'You can only assign users to communities in your college.' });
      }
      newCommunityId = communityIdNum;
      newCollegeId = null;
    } else {
      newCollegeId = null;
      newCommunityId = null;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (newRole === 'dean') {
        await client.query('UPDATE app_users SET college_id = NULL WHERE role = $1 AND college_id = $2 AND id != $3', ['dean', newCollegeId, userId]);
      }
      if (newRole === 'supervisor' || newRole === 'community_leader') {
        await client.query('UPDATE app_users SET community_id = NULL WHERE community_id = $1 AND id != $2', [newCommunityId, userId]);
      }
      await client.query(
        'UPDATE app_users SET role = $1, college_id = $2, community_id = $3 WHERE id = $4',
        [newRole, newCollegeId, newCommunityId, userId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    const r = await pool.query(
      'SELECT u.id, u.email, u.role, u.college_id AS "collegeId", u.community_id AS "communityId", c.name AS "collegeName", co.name AS "communityName" FROM app_users u LEFT JOIN colleges c ON c.id = u.college_id LEFT JOIN communities co ON co.id = u.community_id WHERE u.id = $1',
      [userId]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid college or community' });
    console.error('admin users patch error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** PATCH /api/admin/users/:id/assign-college — assign dean to a college. Each dean is connected with one college; each college has one dean. */
app.patch('/api/admin/users/:id/assign-college', optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const collegeIdNum = Number(req.body?.collegeId);
    if (req.body?.collegeId == null || Number.isNaN(collegeIdNum)) return res.status(400).json({ error: 'collegeId is required' });
    const userCheck = await pool.query('SELECT id, role FROM app_users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (userCheck.rows[0].role !== 'dean') return res.status(400).json({ error: 'User must have role dean' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE app_users SET college_id = NULL WHERE role = $1 AND college_id = $2 AND id != $3', ['dean', collegeIdNum, userId]);
      await client.query('UPDATE app_users SET college_id = $1 WHERE id = $2', [collegeIdNum, userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    const r = await pool.query('SELECT id, email, role, college_id AS "collegeId" FROM app_users WHERE id = $1', [userId]);
    res.json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid college' });
    console.error('assign college error:', err);
    res.status(500).json({ error: 'Failed to assign college' });
  }
});

/** PATCH /api/admin/users/:id/assign-community — assign community leader (supervisor or community_leader). Each community has one leader; each leader leads one community. */
app.patch('/api/admin/users/:id/assign-community', optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const communityIdNum = Number(req.body?.communityId);
    if (req.body?.communityId == null || Number.isNaN(communityIdNum)) return res.status(400).json({ error: 'communityId is required' });
    const userCheck = await pool.query('SELECT id, role FROM app_users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const role = userCheck.rows[0].role;
    if (role !== 'supervisor' && role !== 'community_leader') {
      return res.status(400).json({ error: 'User must have role supervisor or community leader' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE app_users SET community_id = NULL WHERE community_id = $1 AND id != $2', [communityIdNum, userId]);
      await client.query('UPDATE app_users SET community_id = $1 WHERE id = $2', [communityIdNum, userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    const r = await pool.query('SELECT id, email, role, community_id AS "communityId" FROM app_users WHERE id = $1', [userId]);
    res.json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid community' });
    console.error('assign community error:', err);
    res.status(500).json({ error: 'Failed to assign community' });
  }
});

const server = app.listen(PORT, async () => {
  const adminOk = await ensureAdminUser();
  if (!adminOk) {
    console.warn('Admin user not in DB yet. Run "npm run migrate" then restart, or log in with admin@najah.edu to create it.');
  }
  console.log(`Backend server at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env (e.g. PORT=3001).`);
    process.exit(1);
  }
  throw err;
});
