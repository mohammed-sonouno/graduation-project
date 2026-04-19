import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isEmailAllowed, MIN_PASSWORD_LENGTH, validatePassword as validatePasswordRules, isAdminRole, isDeanRole, isSupervisorRole, isCommunityLeaderRole, isStudentRole, EVENT_REQUIRED_FIELDS } from '../config/rules.js';
import { pool } from './db/pool.js';
import { createChatRouter } from './routes/chat.routes.js';
import { createChatMlAdminRouter } from './routes/chatMl.admin.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}

/** Multer config for event images: store in server/uploads/, max 5MB, jpeg/png/webp only. */
const eventImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.mimetype === 'image/png') ? 'png' : (file.mimetype === 'image/webp') ? 'webp' : 'jpg';
    const name = `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  },
});
const uploadEventImage = multer({
  storage: eventImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only image/jpeg, image/png, image/webp are allowed'));
  },
});

/** If image is base64 data URL, save to server/uploads and return filename. Otherwise return null. */
function saveBase64ImageToUploads(base64DataUrl, eventId) {
  if (!base64DataUrl || typeof base64DataUrl !== 'string' || !base64DataUrl.startsWith('data:')) return null;
  const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = (match[1] === 'jpeg' ? 'jpg' : match[1]).slice(0, 4);
  const data = Buffer.from(match[2], 'base64');
  const safeId = (eventId || 'tmp').toString().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 32);
  const filename = `ev-${safeId}-${Date.now()}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  try {
    fs.writeFileSync(filepath, data);
    return filename;
  } catch (err) {
    console.error('saveBase64ImageToUploads error:', err);
    return null;
  }
}

/** Normalize image to filename only for DB storage (no base64, no full URL path). */
function imageToFilename(image) {
  if (!image || typeof image !== 'string') return null;
  const s = image.trim();
  if (!s) return null;
  if (s.startsWith('data:')) return null; // caller should use saveBase64ImageToUploads first
  const basename = path.basename(s).replace(/^\/+/, '');
  return basename || null;
}

const app = express();
// Backend default port (override with PORT in .env if needed)
const PORT = process.env.PORT || 2000;
const JWT_SECRET = process.env.JWT_SECRET || 'graduation-project-secret';

const ADMIN_EMAIL = 'admin@najah.edu';
const ADMIN_PASSWORD = '123';

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
app.use(express.json({ limit: '512kb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

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

/** Get user IDs to notify for event approval workflow (role-based). */
async function getUserIdsByRoleForNotification(role, { communityId = null, collegeId = null } = {}) {
  let q = 'SELECT id FROM app_users WHERE role = $1';
  const params = [role];
  if (role === 'supervisor' && communityId != null) {
    q += ' AND community_id = $2';
    params.push(communityId);
  } else if (role === 'dean' && collegeId != null) {
    q += ' AND college_id = $2';
    params.push(collegeId);
  }
  const r = await pool.query(q, params);
  return (r.rows || []).map((row) => row.id).filter(Boolean);
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

/**
 * Build normalized event row for INSERT (request body + role-derived communityId/clubName).
 * Accepts camelCase from frontend; returns values in DB column order for events table.
 * All JSON/array fields are stringified; booleans are boolean; dates/times as provided (Postgres accepts ISO or YYYY-MM-DD).
 */
function buildEventCreatePayload(body, user, options = {}) {
  const {
    communityId: resolvedCommunityId,
    clubName: resolvedClubName,
    isLeader,
    isAdmin,
  } = options;
  const id = body.id || `ev-${Date.now()}`;
  const title = (body.title != null && String(body.title).trim()) ? String(body.title).trim() : '';
  const description = (body.description != null && String(body.description)) ? String(body.description) : '';
  const category = (body.category != null && String(body.category).trim()) ? String(body.category).trim() : 'Event';
  const image = (body.image != null && String(body.image).trim()) ? String(body.image).trim() : '/event1.jpg';
  const clubName = (resolvedClubName != null && String(resolvedClubName).trim()) ? String(resolvedClubName).trim() : 'University';
  const location = (body.location != null && String(body.location).trim()) ? String(body.location).trim() : '';
  const startDate = body.startDate != null && String(body.startDate).trim() ? String(body.startDate).trim() : null;
  const startTime = body.startTime != null && String(body.startTime).trim() ? String(body.startTime).trim() : null;
  const endDate = body.endDate != null && String(body.endDate).trim() ? String(body.endDate).trim() : null;
  const endTime = body.endTime != null && String(body.endTime).trim() ? String(body.endTime).trim() : null;
  const availableSeats = Number(body.availableSeats);
  const price = Number(body.price);
  const priceMember = body.priceMember != null && body.priceMember !== '' ? Number(body.priceMember) : null;
  const featured = Boolean(body.featured);
  const status = (body.status != null && String(body.status).trim()) ? String(body.status).trim() : 'pending_supervisor';
  const feedback = body.feedback != null && String(body.feedback).trim() ? String(body.feedback).trim() : null;
  const approvalStep = Math.max(0, parseInt(body.approvalStep, 10) || 0);
  const customSections = Array.isArray(body.customSections) ? JSON.stringify(body.customSections) : '[]';
  const communityId = resolvedCommunityId != null ? Number(resolvedCommunityId) : null;
  const forAllColleges = body.forAllColleges !== false;
  const targetCollegeIds = Array.isArray(body.targetCollegeIds) ? body.targetCollegeIds.map(Number).filter((n) => !Number.isNaN(n)) : [];
  const targetAllMajors = body.targetAllMajors !== false;
  const targetMajorIds = Array.isArray(body.targetMajorIds) ? body.targetMajorIds.map(Number).filter((n) => !Number.isNaN(n)) : [];
  const createdBy = user?.id != null ? Number(user.id) : null;

  return {
    id,
    title,
    description,
    category,
    image,
    clubName,
    location,
    startDate,
    startTime,
    endDate,
    endTime,
    availableSeats: Number.isNaN(availableSeats) ? 0 : Math.max(0, availableSeats),
    price: Number.isNaN(price) ? 0 : Math.max(0, price),
    priceMember: priceMember != null && !Number.isNaN(priceMember) ? priceMember : null,
    featured,
    status,
    feedback,
    approvalStep,
    customSections,
    communityId,
    forAllColleges,
    targetCollegeIds,
    targetAllMajors,
    targetMajorIds,
    createdBy,
  };
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
    college: row.college ?? undefined,
    major: row.major ?? undefined,
    student_number: row.student_number ?? undefined,
    picture: row.picture ?? undefined,
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
      `SELECT u.id, u.email, u.role, u.created_at, u.college_id, u.community_id,
              u.first_name, u.middle_name, u.last_name, u.college, u.major,
              u.student_number, u.must_change_password, u.must_complete_profile,
              sp.picture AS picture
       FROM app_users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
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

app.use('/api/chat', optionalAuth, requireAuth, createChatRouter());
app.use('/api/admin/chat-ml', optionalAuth, requireAuth, requireAdmin, createChatMlAdminRouter());

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
      'SELECT id, email, password_hash, role, created_at, college_id, community_id, first_name, middle_name, last_name, college, major, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
      [emailNorm]
    );
    let row = r.rows[0];
    if (!row && emailNorm === ADMIN_EMAIL) {
      await ensureAdminUser();
      r = await pool.query(
        'SELECT id, email, password_hash, role, created_at, college_id, community_id, first_name, middle_name, last_name, college, major, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
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
    const sp = await pool.query('SELECT picture FROM student_profiles WHERE user_id = $1', [user.id]);
    if (sp.rows[0]?.picture != null) user.picture = sp.rows[0].picture;
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
    console.info('[request-login-code] incoming', {
      email: emailNorm,
      hasSmtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    });
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
    console.info('[request-login-code] code generated and saved', { email: emailNorm });
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    if (hasSmtp) {
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
        console.info('[request-login-code] sending email via SMTP', {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          to: emailNorm,
        });
        const info = await transporter.sendMail({
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
        console.info('[request-login-code] email sent', {
          email: emailNorm,
          messageId: info && info.messageId ? info.messageId : undefined,
        });
      } catch (mailErr) {
        console.error('Send login code email error:', mailErr);
        // Treat email send failure as a hard error so frontend does not show a false success state.
        throw mailErr;
      }
    } else {
      console.warn('[request-login-code] SMTP not configured; login code email will NOT be sent. Code is logged for development only.');
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
      'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, college, major, student_number, must_change_password, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
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
    const sp = await pool.query('SELECT picture FROM student_profiles WHERE user_id = $1', [user.id]);
    if (sp.rows[0]?.picture != null) user.picture = sp.rows[0].picture;
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
'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, college, major, student_number, must_complete_profile FROM app_users WHERE email = $1 LIMIT 1',
    [emailNorm]
  )).rows[0];

    // Send 6-digit code for both existing and new users (same as email sign-in flow).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRY_MINUTES * 60 * 1000);
    await pool.query(
      'INSERT INTO login_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [emailNorm, code, expiresAt]
    );
    console.info('[google-login-code] code generated and saved', { email: emailNorm });
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    if (hasSmtp) {
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
        console.info('[google-login-code] sending email via SMTP', {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          to: emailNorm,
        });
        const info = await transporter.sendMail({
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
        console.info('[google-login-code] email sent', {
          email: emailNorm,
          messageId: info && info.messageId ? info.messageId : undefined,
        });
      } catch (mailErr) {
        console.error('Send login code email error:', mailErr);
        // Treat email send failure as a hard error so frontend does not show a false success state.
        throw mailErr;
      }
    } else {
      console.warn('[google-login-code] SMTP not configured; login code email will NOT be sent. Code is logged for development only.');
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
    if (pictureFromPayload && row?.id) {
      await pool.query(
        `INSERT INTO student_profiles (user_id, college, major, gpa, credits_earned, credits_total, picture, updated_at)
         VALUES ($1, NULL, NULL, NULL, NULL, NULL, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET picture = COALESCE(EXCLUDED.picture, student_profiles.picture), updated_at = NOW()`,
        [row.id, pictureFromPayload]
      );
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
'SELECT id, email, role, created_at, college_id, community_id, first_name, middle_name, last_name, college, major, student_number, must_change_password, must_complete_profile FROM app_users WHERE id = $1',
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

/** GET /api/colleges — list all colleges from DB for cards, filters, and dropdowns. */
app.get('/api/colleges', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, name FROM colleges ORDER BY name');
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
      `SELECT m.id, m.name, m.college_id AS "collegeId", c.name AS "collegeName", c.name AS "college_short_name",
              x.category AS "chatCategory",
              x.greeting_en AS "chatGreetingEn",
              x.greeting_ar AS "chatGreetingAr",
              x.suggested_questions_en AS "chatSuggestedEn",
              x.suggested_questions_ar AS "chatSuggestedAr"
       FROM majors m
       LEFT JOIN colleges c ON c.id = m.college_id
       LEFT JOIN major_chat_context x ON x.major_id = m.id
       WHERE m.id = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Major not found' });
    const row = r.rows[0];
    const toArr = (v) => (Array.isArray(v) ? v.map(String) : []);
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
      chat: {
        category: row.chatCategory || null,
        greetingEn: row.chatGreetingEn || null,
        greetingAr: row.chatGreetingAr || null,
        suggestedEn: toArr(row.chatSuggestedEn),
        suggestedAr: toArr(row.chatSuggestedAr)
      }
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
  e.approval_step AS "approvalStep", e.rejected_at_step AS "rejectedAtStep", e.requested_changes_at_step AS "requestedChangesAtStep", e.custom_sections AS "customSections", e.created_at AS "createdAt",
  e.community_id AS "communityId", c.name AS "communityName", col.id AS "collegeId", col.name AS "collegeName",
  COALESCE(e.for_all_colleges, true) AS "forAllColleges",
  COALESCE(e.target_college_ids, '[]'::jsonb) AS "targetCollegeIds",
  COALESCE(e.target_all_majors, true) AS "targetAllMajors",
  COALESCE(e.target_major_ids, '[]'::jsonb) AS "targetMajorIds"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** Same as EVENTS_SELECT but without requested_changes_at_step (for DBs before migration 034). */
const EVENTS_SELECT_LEGACY = `SELECT e.id, e.title, e.description, e.category, e.image, e.club_name AS "clubName", e.location,
  e.start_date AS "startDate", e.start_time AS "startTime", e.end_date AS "endDate", e.end_time AS "endTime",
  e.available_seats AS "availableSeats", e.price, e.price_member AS "priceMember", e.featured, e.status, e.feedback,
  e.approval_step AS "approvalStep", e.rejected_at_step AS "rejectedAtStep", e.custom_sections AS "customSections", e.created_at AS "createdAt",
  e.community_id AS "communityId", c.name AS "communityName", col.id AS "collegeId", col.name AS "collegeName",
  COALESCE(e.for_all_colleges, true) AS "forAllColleges",
  COALESCE(e.target_college_ids, '[]'::jsonb) AS "targetCollegeIds",
  COALESCE(e.target_all_majors, true) AS "targetAllMajors",
  COALESCE(e.target_major_ids, '[]'::jsonb) AS "targetMajorIds"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

const EVENTS_LIST_SELECT = `SELECT e.id, e.title, e.description, e.image, e.start_date AS "startDate", e.start_time AS "startTime",
  e.end_date AS "endDate", e.end_time AS "endTime", e.location, e.featured, e.status, e.category,
  e.club_name AS "clubName", e.price, e.price_member AS "priceMember", e.created_at AS "createdAt",
  c.name AS "communityName", col.name AS "collegeName"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** Minimal fields for Manage Events list only. No description, customSections, or JSONB arrays.
 * Image: return NULL when stored as base64 data URL to avoid huge payloads; frontend uses default image. */
const ADMIN_EVENTS_LIST_SELECT = `SELECT e.id, e.title, e.status,
  COALESCE(e.approval_step, 0) AS "approvalStep",
  e.rejected_at_step AS "rejectedAtStep", e.requested_changes_at_step AS "requestedChangesAtStep",
  e.start_date AS "startDate", e.start_time AS "startTime",
  (CASE WHEN e.image IS NOT NULL AND (e.image::text LIKE 'data:%') THEN NULL ELSE e.image END) AS "image",
  e.feedback, e.community_id AS "communityId",
  c.name AS "communityName", col.name AS "collegeName"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** Same as above but without rejected_at_step (for DBs that have not run migration 032). */
const ADMIN_EVENTS_LIST_SELECT_LEGACY = `SELECT e.id, e.title, e.status,
  COALESCE(e.approval_step, 0) AS "approvalStep",
  e.start_date AS "startDate", e.start_time AS "startTime",
  (CASE WHEN e.image IS NOT NULL AND (e.image::text LIKE 'data:%') THEN NULL ELSE e.image END) AS "image",
  e.feedback, e.community_id AS "communityId",
  c.name AS "communityName", col.name AS "collegeName"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** Full fields for Event Approval page cards (description, customSections, etc.). */
const ADMIN_EVENTS_APPROVAL_SELECT = `SELECT e.id, e.title, e.description, e.status,
  COALESCE(e.approval_step, 0) AS "approvalStep",
  e.rejected_at_step AS "rejectedAtStep", e.requested_changes_at_step AS "requestedChangesAtStep",
  e.start_date AS "startDate", e.start_time AS "startTime", e.end_date AS "endDate", e.end_time AS "endTime",
  e.location, e.available_seats AS "availableSeats", e.price, e.price_member AS "priceMember",
  e.category, e.club_name AS "clubName",
  (CASE WHEN e.image IS NOT NULL AND (e.image::text LIKE 'data:%') THEN NULL ELSE e.image END) AS "image",
  e.feedback, e.community_id AS "communityId",
  e.custom_sections AS "customSections",
  c.name AS "communityName", col.id AS "collegeId", col.name AS "collegeName"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

const ADMIN_EVENTS_APPROVAL_SELECT_LEGACY = `SELECT e.id, e.title, e.description, e.status,
  COALESCE(e.approval_step, 0) AS "approvalStep",
  e.start_date AS "startDate", e.start_time AS "startTime", e.end_date AS "endDate", e.end_time AS "endTime",
  e.location, e.available_seats AS "availableSeats", e.price, e.price_member AS "priceMember",
  e.category, e.club_name AS "clubName",
  (CASE WHEN e.image IS NOT NULL AND (e.image::text LIKE 'data:%') THEN NULL ELSE e.image END) AS "image",
  e.feedback, e.community_id AS "communityId",
  e.custom_sections AS "customSections",
  c.name AS "communityName", col.id AS "collegeId", col.name AS "collegeName"
  FROM events e
  LEFT JOIN communities c ON c.id = e.community_id
  LEFT JOIN colleges col ON col.id = c.college_id`;

/** GET /api/events — public list (approved). Returns minimal fields for cards; use GET /api/events/:id for full details. */
app.get('/api/events', optionalAuth, async (req, res) => {
  try {
    const status = req.query.status;
    let q = EVENTS_LIST_SELECT + ' WHERE 1=1';
    const params = [];
    if (status) {
      params.push(status);
      q += ` AND e.status = $${params.length}`;
    } else {
      q += " AND (e.status IN ('approved', 'upcoming', 'past') OR e.status IS NULL)";
    }
    q += ' ORDER BY e.created_at DESC, e.id DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('events list error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

/** GET /api/events/:id — includes resolved audience names, seatsRemaining, and optional myRegistration for auth user. */
app.get('/api/events/:id', optionalAuth, async (req, res) => {
  try {
    let r;
    try {
      r = await pool.query(EVENTS_SELECT + ' WHERE e.id = $1', [req.params.id]);
    } catch (queryErr) {
      const msg = String(queryErr?.message || '');
      if (/requested_changes_at_step|column.*does not exist/i.test(msg)) {
        r = await pool.query(EVENTS_SELECT_LEGACY + ' WHERE e.id = $1', [req.params.id]);
        if (r.rows[0]) r.rows[0].requestedChangesAtStep = null;
      } else {
        console.error('GET /api/events/:id query error:', queryErr?.message, queryErr?.code, queryErr?.detail || '');
        throw queryErr;
      }
    }
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
    const totalCapacity = row.availableSeats != null ? Number(row.availableSeats) : 0;
    const countResult = await pool.query(
      'SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = $1 AND status = $2',
      [req.params.id, 'approved']
    );
    const approvedCount = parseInt(countResult.rows[0]?.cnt || '0', 10);
    // totalCapacity: max seats; approvedCount: filled seats; seatsRemaining: total - filled (never below 0)
    row.totalCapacity = totalCapacity;
    row.seatsFilled = approvedCount;
    row.seatsRemaining = totalCapacity > 0 ? Math.max(0, totalCapacity - approvedCount) : totalCapacity;
    if (req.user?.id) {
      const myReg = await pool.query(
        'SELECT status FROM event_registrations WHERE user_id = $1 AND event_id = $2',
        [req.user.id, req.params.id]
      );
      if (myReg.rows.length > 0) {
        row.myRegistration = { status: myReg.rows[0].status };
      } else {
        row.myRegistration = null;
      }
    } else {
      row.myRegistration = null;
    }
    res.json(row);
  } catch (err) {
    console.error('event get error:', err?.message, err?.code, err?.detail || '');
    res.status(500).json({ error: 'Failed to load event' });
  }
});

// ——— Temporary debug: actual events table columns (remove after fixing INSERT mismatch) ———
app.get('/api/debug/events-columns', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position`
    );
    console.log('events table columns:', r.rows.map((row) => `${row.column_name} (${row.data_type})`).join(', '));
    res.json({ columns: r.rows });
  } catch (e) {
    console.error('debug events-columns:', e);
    res.status(500).json({ error: e?.message });
  }
});

/** POST /api/upload-event-image — multipart/form-data field "image". Returns { filename, url }. Auth required. */
app.post('/api/upload-event-image', optionalAuth, requireAuth, uploadEventImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use form field "image".' });
    }
    const filename = req.file.filename;
    res.status(201).json({ filename, url: `/uploads/${filename}` });
  } catch (err) {
    console.error('upload-event-image error:', err?.message || err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be 5MB or less' });
    if (err.message && (err.message.includes('image/jpeg') || err.message.includes('Only image'))) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// ——— Admin-only routes (requireAdmin): add any new admin feature here and use requireAdmin ———
// POST /api/events, PUT /api/events/:id, PATCH /api/events/:id/approve, PATCH /api/events/:id/reject,
// DELETE /api/events/:id, GET /api/admin/events
/** POST /api/events — community leaders (their community) or admin (any community via body.communityId) can create events. */
app.post('/api/events', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const b = req.body || {};
    const isAdminUser = isAdminRole(user?.role);
    const isLeaderUser = isCommunityLeaderRole(user?.role) && user?.community_id != null;

    let communityId;
    let clubName;
    if (isAdminUser) {
      const bodyCommunityId = b.communityId != null && b.communityId !== '' ? Number(b.communityId) : null;
      if (bodyCommunityId == null || Number.isNaN(bodyCommunityId)) {
        return res.status(400).json({ error: 'Admin must provide a community (Club / Association) for the event.' });
      }
      communityId = bodyCommunityId;
      const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
      const community = cr.rows[0];
      if (!community) return res.status(400).json({ error: 'Community not found' });
      clubName = community.name || 'University';
    } else if (isLeaderUser) {
      communityId = Number(user.community_id);
      const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
      const community = cr.rows[0];
      if (!community) return res.status(400).json({ error: 'Community not found' });
      clubName = community.name || 'University';
    } else {
      return res.status(403).json({ error: 'Only community leaders or admin can create events.' });
    }

    const validationError = validateRequiredEventFields(b);
    if (validationError) {
      return res.status(400).json({ error: validationError });
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

    const row = buildEventCreatePayload(b, req.user, {
      communityId,
      clubName,
      isLeader: isLeaderUser,
      isAdmin: isAdminUser,
    });
    const isAdminCreate = req.user && req.user.role === 'admin';
    if (isAdminCreate) {
      row.status = 'approved';
      row.approvalStep = 3;
      row.supervisorApproved = true;
      row.deanApproved = true;
      row.adminApproved = true;
      row.supervisorApprovedAt = new Date();
      row.deanApprovedAt = new Date();
      row.adminApprovedAt = new Date();
    } else {
      row.status = 'pending_supervisor';
      row.approvalStep = 0;
      row.supervisorApproved = false;
      row.deanApproved = false;
      row.adminApproved = false;
      row.supervisorApprovedAt = null;
      row.deanApprovedAt = null;
      row.adminApprovedAt = null;
    }
    if (row.image && row.image.startsWith('data:')) {
      const saved = saveBase64ImageToUploads(row.image, row.id);
      if (saved) row.image = saved;
      else row.image = 'event1.jpg';
    } else {
      const filename = imageToFilename(row.image);
      row.image = (filename && filename.trim()) ? filename : 'event1.jpg';
    }

    const query = `INSERT INTO events (id, title, description, category, image, club_name, location, start_date, start_time, end_date, end_time, available_seats, price, price_member, featured, status, feedback, approval_step, custom_sections, community_id, for_all_colleges, target_college_ids, target_all_majors, target_major_ids, created_by, updated_at, supervisor_approved, dean_approved, admin_approved, supervisor_approved_at, dean_approved_at, admin_approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),$26,$27,$28,$29,$30,$31)`;
    const values = [
      row.id,
      row.title,
      row.description,
      row.category,
      row.image,
      row.clubName,
      row.location,
      row.startDate,
      row.startTime,
      row.endDate,
      row.endTime,
      row.availableSeats,
      row.price,
      row.priceMember,
      row.featured,
      row.status,
      row.feedback,
      row.approvalStep,
      row.customSections,
      row.communityId,
      row.forAllColleges,
      JSON.stringify(row.targetCollegeIds),
      row.targetAllMajors,
      JSON.stringify(row.targetMajorIds),
      row.createdBy,
      row.supervisorApproved,
      row.deanApproved,
      row.adminApproved,
      row.supervisorApprovedAt,
      row.deanApprovedAt,
      row.adminApprovedAt,
    ];
    await pool.query(query, values);
    const r = await pool.query('SELECT id, title, status, start_date AS "startDate", start_time AS "startTime", created_at AS "createdAt", created_by AS "createdBy", community_id FROM events WHERE id = $1', [row.id]);
    const created = r.rows[0];
    if (!isAdminCreate) {
      const supervisorIds = await getUserIdsByRoleForNotification('supervisor', { communityId: row.communityId });
      for (const uid of supervisorIds) {
        await createNotification(uid, 'Event pending your approval', 'A new event is waiting for your approval.');
      }
    }
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid community. Each event must be connected to an existing community.' });
    console.error('event create error:', err?.message, err?.code, err?.detail || '');
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', optionalAuth, requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isCommunityLeader = isCommunityLeaderRole(user?.role);
    const isLeader = (isCommunityLeader || isSupervisorRole(user?.role)) && user?.community_id != null;
    const isDean = isDeanRole(user?.role);
    if (!isAdmin && !isLeader && !isDean) {
      return res.status(403).json({ error: 'Only admin, dean, or community leader can edit events' });
    }
    let existing;
    try {
      existing = await pool.query(
        'SELECT id, community_id, status, COALESCE(requested_changes_at_step, -1) AS requested_changes_at_step FROM events WHERE id = $1',
        [id]
      );
    } catch (selectErr) {
      const msg = String(selectErr?.message || '');
      if (/requested_changes_at_step|column.*does not exist/i.test(msg)) {
        existing = await pool.query('SELECT id, community_id, status FROM events WHERE id = $1', [id]);
      } else {
        console.error('event update SELECT error:', selectErr?.message, selectErr?.code, selectErr?.detail || '');
        throw selectErr;
      }
    }
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const existingRow = existing.rows[0];
    const existingStatus = (existingRow.status || '').trim();
    const requestedChangesAtStep = existingRow.requested_changes_at_step != null ? Number(existingRow.requested_changes_at_step) : -1;

    if (existingStatus === 'changes_requested') {
      if (!isCommunityLeader || user?.community_id == null || Number(existingRow.community_id) !== Number(user.community_id)) {
        return res.status(403).json({ error: 'Only the community leader for this event can fix changes-requested events. Other roles may not edit event content.' });
      }
    } else if (isLeader && !isAdmin) {
      if (Number(existingRow.community_id) !== Number(user.community_id)) return res.status(403).json({ error: 'You can edit only events of your community' });
    }
    const b = req.body || {};
    const validationError = validateRequiredEventFields(b);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    let communityId;
    let clubName = 'University';
    if (isLeader && !isAdmin) {
      if (user.community_id == null) {
        return res.status(400).json({ error: 'Your account is not linked to a community. Contact an administrator.' });
      }
      communityId = Number(user.community_id);
      const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
      const community = cr.rows[0];
      if (!community) return res.status(400).json({ error: 'Community not found' });
      clubName = community.name || 'University';
    } else {
      if (b.communityId == null || b.communityId === '') {
        return res.status(400).json({ error: 'communityId is required. Each event must be connected to a community.' });
      }
      communityId = Number(b.communityId);
      const cr = await pool.query('SELECT id, name, college_id FROM communities WHERE id = $1', [communityId]);
      const community = cr.rows[0];
      if (!community) return res.status(400).json({ error: 'Community not found' });
      if (isDean && !isAdmin) {
        if (user.college_id == null || Number(community.college_id) !== Number(user.college_id)) {
          return res.status(403).json({ error: 'You can assign events only to communities in your college' });
        }
      }
      clubName = (isDean && !isAdmin && community.name) ? community.name : (b.clubName ?? community.name ?? 'University');
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
    let imageVal = b.image ?? 'event1.jpg';
    if (imageVal && imageVal.startsWith('data:')) {
      const saved = saveBase64ImageToUploads(imageVal, id);
      if (saved) imageVal = saved;
      else imageVal = 'event1.jpg';
    } else {
      const filename = imageToFilename(imageVal);
      imageVal = (filename && filename.trim()) ? filename : 'event1.jpg';
    }

    let finalStatus = b.status ?? 'draft';
    let finalFeedback = b.feedback ?? null;
    let finalApprovalStep = b.approvalStep ?? 0;
    let finalRequestedChangesAtStep = existingRow.requested_changes_at_step ?? null;
    if (existingStatus === 'changes_requested' && requestedChangesAtStep >= 0 && requestedChangesAtStep <= 2) {
      finalStatus = requestedChangesAtStep === 0 ? 'pending_supervisor' : requestedChangesAtStep === 1 ? 'pending_dean' : 'pending_admin';
      finalApprovalStep = requestedChangesAtStep;
      finalFeedback = null;
      finalRequestedChangesAtStep = null;
    }

    const updateParams = [
      id,
      b.title ?? '',
      b.description ?? '',
      b.category ?? 'Event',
      imageVal,
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
      finalStatus,
      finalFeedback,
      finalApprovalStep,
      JSON.stringify(b.customSections || []),
      communityId,
      forAllColleges,
      JSON.stringify(targetCollegeIds),
      targetAllMajors,
      JSON.stringify(targetMajorIds),
    ];
    try {
      await pool.query(
        `UPDATE events SET title=$2, description=$3, category=$4, image=$5, club_name=$6, location=$7, start_date=$8, start_time=$9, end_date=$10, end_time=$11, available_seats=$12, price=$13, price_member=$14, featured=$15, status=$16::varchar, feedback=$17, approval_step=$18, custom_sections=$19, community_id=$20, for_all_colleges=$21, target_college_ids=$22, target_all_majors=$23, target_major_ids=$24, rejected_at_step = CASE WHEN $16::varchar = 'pending_supervisor' THEN NULL ELSE rejected_at_step END, requested_changes_at_step = $25::integer, updated_at=NOW() WHERE id=$1`,
        [...updateParams, finalRequestedChangesAtStep]
      );
    } catch (updateErr) {
      const msg = String(updateErr?.message || '');
      if (/requested_changes_at_step|column.*does not exist/i.test(msg)) {
        await pool.query(
          `UPDATE events SET title=$2, description=$3, category=$4, image=$5, club_name=$6, location=$7, start_date=$8, start_time=$9, end_date=$10, end_time=$11, available_seats=$12, price=$13, price_member=$14, featured=$15, status=$16::varchar, feedback=$17, approval_step=$18, custom_sections=$19, community_id=$20, for_all_colleges=$21, target_college_ids=$22, target_all_majors=$23, target_major_ids=$24, rejected_at_step = CASE WHEN $16::varchar = 'pending_supervisor' THEN NULL ELSE rejected_at_step END, updated_at=NOW() WHERE id=$1`,
          updateParams
        );
      } else {
        console.error('event update error:', updateErr?.message, updateErr?.code, updateErr?.detail || '');
        throw updateErr;
      }
    }
    if (String(finalStatus || '').trim() === 'pending_supervisor') {
      const supervisorIds = await getUserIdsByRoleForNotification('supervisor', { communityId });
      for (const uid of supervisorIds) {
        await createNotification(uid, 'Event pending your approval', 'A new event is waiting for your approval.');
      }
    } else if (finalStatus === 'pending_dean' || finalStatus === 'pending_admin') {
      const eventAfter = await pool.query('SELECT community_id FROM events WHERE id = $1', [id]);
      const communityIdForNotif = eventAfter.rows[0]?.community_id;
      const cRow = communityIdForNotif ? (await pool.query('SELECT college_id FROM communities WHERE id = $1', [communityIdForNotif])).rows[0] : null;
      const collegeIdForNotif = cRow?.college_id;
      if (finalStatus === 'pending_dean' && collegeIdForNotif != null) {
        const deanIds = await getUserIdsByRoleForNotification('dean', { collegeId: collegeIdForNotif });
        for (const uid of deanIds) {
          await createNotification(uid, 'Event resubmitted for your approval', 'An event was updated and is waiting for your review again.');
        }
      } else if (finalStatus === 'pending_admin') {
        const adminIds = await getUserIdsByRoleForNotification('admin');
        for (const uid of adminIds) {
          await createNotification(uid, 'Event resubmitted for your approval', 'An event was updated and is waiting for your review again.');
        }
      }
    }
    const r = await pool.query('SELECT id, title, status, start_date AS "startDate", start_time AS "startTime" FROM events WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(400).json({ error: 'Invalid community. Each event must be connected to an existing community.' });
    console.error('event update error:', err?.message, err?.code, err?.detail || '');
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * PATCH /api/events/:id/set-featured
 *
 * Admin only. Sets this event as the single featured event; all others are unset.
 */
app.patch('/api/events/:id/set-featured', optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) return res.status(400).json({ error: 'Invalid event id' });
    const exist = await pool.query('SELECT id FROM events WHERE id = $1', [id]);
    if (exist.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    await pool.query('UPDATE events SET featured = (id = $1)', [id]);
    const r = await pool.query('SELECT id, title, featured FROM events WHERE id = $1', [id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('set-featured error:', err?.message);
    res.status(500).json({ error: 'Failed to set featured event' });
  }
});

/**
 * PATCH /api/events/:id/request-changes
 *
 * Supervisor / Dean / Admin requests changes; event goes to changes_requested and leader is notified.
 */
app.patch('/api/events/:id/request-changes', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isSupervisor = isSupervisorRole(user?.role);
    const isDean = isDeanRole(user?.role);
    const feedback = (req.body || {}).feedback || null;

    const er = await pool.query(
      `SELECT e.id, e.status, COALESCE(e.approval_step, 0) AS approval_step,
              e.community_id, e.created_by,
              c.college_id AS college_id
       FROM events e
       LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (er.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = er.rows[0];
    const status = (event.status || '').trim();
    const step = Number(event.approval_step) || 0;
    const isPendingSupervisor = status === 'pending_supervisor' || (status === 'pending' && step === 0);
    const isPendingDean = status === 'pending_dean' || (status === 'pending' && step === 1);
    const isPendingAdmin = status === 'pending_admin' || (status === 'pending' && step === 2);

    let allowed = false;
    if (isPendingSupervisor && isSupervisor && user?.community_id != null && event.community_id != null) {
      allowed = Number(user.community_id) === Number(event.community_id);
    } else if (isPendingDean && isDean && user?.college_id != null && event.college_id != null) {
      allowed = Number(user.college_id) === Number(event.college_id);
    } else if (isPendingAdmin && isAdmin) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only the current approver can request changes at this step.' });
    }

    const requestedAtStep = isPendingSupervisor ? 0 : isPendingDean ? 1 : 2;
    try {
      await pool.query(
        `UPDATE events SET status = $2::varchar, feedback = $3, requested_changes_at_step = $4::integer, updated_at = NOW() WHERE id = $1`,
        [event.id, 'changes_requested', feedback, requestedAtStep]
      );
    } catch (updateErr) {
      const msg = String(updateErr?.message || '');
      if (/requested_changes_at_step|column.*does not exist/i.test(msg)) {
        await pool.query(
          'UPDATE events SET status = $2, feedback = $3, updated_at = NOW() WHERE id = $1',
          [event.id, 'changes_requested', feedback]
        );
      } else {
        console.error('event request-changes UPDATE error:', updateErr?.message, updateErr?.code, updateErr?.detail || '');
        throw updateErr;
      }
    }
    if (event.created_by) {
      await createNotification(event.created_by, 'Changes requested', 'Changes were requested for your event.');
    }
    let r;
    try {
      r = await pool.query(
        'SELECT id, status, COALESCE(approval_step, 0) AS "approvalStep", feedback, requested_changes_at_step AS "requestedChangesAtStep" FROM events WHERE id = $1',
        [event.id]
      );
    } catch (selectErr) {
      const msg = String(selectErr?.message || '');
      if (/requested_changes_at_step|column.*does not exist/i.test(msg)) {
        r = await pool.query(
          'SELECT id, status, COALESCE(approval_step, 0) AS "approvalStep", feedback FROM events WHERE id = $1',
          [event.id]
        );
        if (r.rows[0]) r.rows[0].requestedChangesAtStep = null;
      } else {
        throw selectErr;
      }
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error('event request-changes error:', err?.message, err?.code, err?.detail || '');
    res.status(500).json({ error: 'Failed to request changes' });
  }
});

/**
 * PATCH /api/events/:id/approve
 *
 * Staged approval: pending_supervisor -> supervisor approves -> pending_dean
 * -> dean approves -> pending_admin -> admin approves -> approved.
 * A higher role must NOT see the event until the lower role has approved.
 */
app.patch('/api/events/:id/approve', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isSupervisor = isSupervisorRole(user?.role);
    const isDean = isDeanRole(user?.role);

    const er = await pool.query(
      `SELECT e.id, e.status, COALESCE(e.approval_step, 0) AS approval_step,
              e.community_id, e.created_by,
              c.college_id AS college_id
       FROM events e
       LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (er.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = er.rows[0];
    const currentStep = Number(event.approval_step) || 0;
    const status = (event.status || '').trim();

    if (status === 'rejected' || status === 'draft') {
      return res.status(400).json({ error: 'Event is not pending approval' });
    }

    const isPendingSupervisor = status === 'pending_supervisor' || (status === 'pending' && currentStep === 0);
    const isPendingDean = status === 'pending_dean' || (status === 'pending' && currentStep === 1);
    const isPendingAdmin = status === 'pending_admin' || (status === 'pending' && currentStep === 2);

    let nextStep = currentStep;
    let newStatus = event.status;

    if (isPendingSupervisor) {
      const isCommunitySupervisor =
        isSupervisor &&
        user?.community_id != null &&
        event.community_id != null &&
        Number(user.community_id) === Number(event.community_id);
      if (!isCommunitySupervisor) {
        return res.status(403).json({ error: 'Only the supervisor of this community can approve at this step. Admin cannot approve before supervisor.' });
      }
      nextStep = 1;
      newStatus = 'pending_dean';
    } else if (isPendingDean) {
      const isCollegeDean =
        isDean &&
        user?.college_id != null &&
        event.college_id != null &&
        Number(user.college_id) === Number(event.college_id);
      if (!isCollegeDean) {
        return res.status(403).json({ error: 'Only the dean of this college can approve at this step. Admin cannot approve before dean.' });
      }
      nextStep = 2;
      newStatus = 'pending_admin';
    } else if (isPendingAdmin) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admin can give final approval' });
      }
      nextStep = 3;
      newStatus = 'approved';
    } else {
      return res.status(400).json({ error: 'Event is already fully approved' });
    }

    await pool.query(
      'UPDATE events SET approval_step = $2, status = $3, rejected_at_step = NULL, updated_at = NOW() WHERE id = $1',
      [event.id, nextStep, newStatus]
    );

    const r = await pool.query(
      'SELECT id, title, status, COALESCE(approval_step, 0) AS "approvalStep", created_by AS "createdBy" FROM events WHERE id = $1',
      [event.id]
    );
    const updated = r.rows[0];

    if (newStatus === 'pending_dean') {
      const deanIds = await getUserIdsByRoleForNotification('dean', { collegeId: event.college_id });
      for (const uid of deanIds) {
        await createNotification(uid, 'Event pending your approval', 'A new event is waiting for your approval.');
      }
    } else if (newStatus === 'pending_admin') {
      const adminIds = await getUserIdsByRoleForNotification('admin');
      for (const uid of adminIds) {
        await createNotification(uid, 'Event pending your approval', 'A new event is waiting for your approval.');
      }
    } else if (newStatus === 'approved' && updated?.createdBy) {
      await createNotification(updated.createdBy, 'Event approved', 'Your event has been approved.');
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
 * Reject moves event back to draft and notifies the association leader.
 */
app.patch('/api/events/:id/reject', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isSupervisor = isSupervisorRole(user?.role);
    const isDean = isDeanRole(user?.role);
    const feedback = (req.body || {}).feedback || null;

    const er = await pool.query(
      `SELECT e.id, e.status, COALESCE(e.approval_step, 0) AS approval_step,
              e.community_id, e.created_by,
              c.college_id AS college_id
       FROM events e
       LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (er.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = er.rows[0];
    const status = (event.status || '').trim();
    const step = Number(event.approval_step) || 0;
    const isPendingSupervisor = status === 'pending_supervisor' || (status === 'pending' && step === 0);
    const isPendingDean = status === 'pending_dean' || (status === 'pending' && step === 1);
    const isPendingAdmin = status === 'pending_admin' || (status === 'pending' && step === 2);

    let allowed = false;
    if (isPendingSupervisor && isSupervisor && user?.community_id != null && event.community_id != null) {
      allowed = Number(user.community_id) === Number(event.community_id);
    } else if (isPendingDean && isDean && user?.college_id != null && event.college_id != null) {
      allowed = Number(user.college_id) === Number(event.college_id);
    } else if (isPendingAdmin && isAdmin) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only the current approver can reject this event at this step.' });
    }

    const rejectedAtStep = isPendingSupervisor ? 0 : isPendingDean ? 1 : 2;
    await pool.query(
      'UPDATE events SET status = $2, approval_step = 0, feedback = $3, rejected_at_step = $4, updated_at = NOW() WHERE id = $1',
      [event.id, 'draft', feedback, rejectedAtStep]
    );
    if (event.created_by) {
      await createNotification(event.created_by, 'Event rejected', 'Your event was rejected and returned to draft.');
    }
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
    const existing = await pool.query('SELECT id, community_id, status FROM events WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const eventRow = existing.rows[0];
    if ((eventRow.status || '').trim() !== 'draft') {
      return res.status(400).json({ error: 'Only draft events can be deleted. Pending or approved events cannot be deleted.' });
    }
    if (isLeader && !isAdmin) {
      if (Number(eventRow.community_id) !== Number(user.community_id)) return res.status(403).json({ error: 'You can delete only events of your community' });
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
       e.title, e.start_date AS "date", e.start_time AS "time",
       e.end_date AS "endDate", e.end_time AS "endTime",
       e.image, e.location
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

/** POST /api/event-registrations — register for an event (status = pending; only community leader can approve/reject). */
app.post('/api/event-registrations', optionalAuth, requireAuth, async (req, res) => {
  try {
    const { eventId, associationMember } = req.body || {};
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const ev = await pool.query(
      `SELECT id, status, community_id, title, available_seats,
       COALESCE(for_all_colleges, true) AS for_all_colleges,
       COALESCE(target_college_ids, '[]'::jsonb) AS target_college_ids,
       COALESCE(target_all_majors, true) AS target_all_majors,
       COALESCE(target_major_ids, '[]'::jsonb) AS target_major_ids
       FROM events WHERE id = $1`,
      [eventId]
    );
    if (ev.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const eventRow = ev.rows[0];
    const eventStatus = eventRow.status || 'draft';
    if (!['approved', 'upcoming', 'past'].includes(eventStatus)) {
      return res.status(400).json({ error: 'You cannot register for this event yet.' });
    }

    const capacity = eventRow.available_seats != null ? Number(eventRow.available_seats) : 0;
    if (capacity > 0) {
      const countResult = await pool.query(
        'SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = $1 AND status = $2',
        [eventId, 'approved']
      );
      const approvedCount = parseInt(countResult.rows[0]?.cnt || '0', 10);
      if (approvedCount >= capacity) {
        return res.status(400).json({ error: 'Event is full. Registration is closed.' });
      }
    }

    const existing = await pool.query(
      'SELECT id, status FROM event_registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, eventId]
    );
    if (existing.rows.length > 0) {
      const ex = existing.rows[0];
      if (ex.status === 'approved') {
        return res.status(400).json({ error: 'You are already registered for this event.' });
      }
      if (ex.status === 'pending' || ex.status === 'pending_payment') {
        return res.status(400).json({ error: 'You already have a pending request for this event.' });
      }
      if (ex.status === 'rejected') {
        await pool.query(
          'UPDATE event_registrations SET status = $1, decided_by = NULL, decided_at = NULL WHERE id = $2',
          ['pending', ex.id]
        );
        if (eventRow.community_id != null) {
          const lr = await pool.query(
            "SELECT id FROM app_users WHERE community_id = $1 AND role IN ('supervisor','community_leader')",
            [eventRow.community_id]
          );
          for (const leader of lr.rows || []) {
            if (leader?.id) {
              await createNotification(
                leader.id,
                'New registration request',
                `A student has requested to join your event "${eventRow.title || eventId}". Approve or reject from the Event Registrations page.`
              );
            }
          }
        }
        const r = await pool.query(
          'SELECT id, event_id AS "eventId", status, created_at AS "createdAt" FROM event_registrations WHERE id = $1',
          [ex.id]
        );
        return res.status(200).json(r.rows[0]);
      }
    }

    const ur = await pool.query(
      `SELECT u.first_name, u.middle_name, u.last_name, u.student_number, u.email,
              u.college, u.major, sp.college AS profile_college, sp.major AS profile_major
       FROM app_users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
      [req.user.id]
    );
    if (ur.rows.length === 0) return res.status(400).json({ error: 'User profile not found for registration' });
    const row = ur.rows[0];
    const studentId = row.student_number || null;
    const college = row.college || row.profile_college || null;
    const major = row.major || row.profile_major || null;
    const baseNameParts = [row.first_name, row.middle_name, row.last_name].filter(Boolean);
    const name = (baseNameParts.length ? baseNameParts.join(' ') : null) || (row.email ? row.email.split('@')[0] : null) || row.email;
    const email = row.email || req.user.email;

    const canJoin = await canStudentJoinEvent(pool, eventRow, college, major);
    if (!canJoin) {
      return res.status(403).json({
        error: 'This event is only open to students from specific colleges or majors. Your profile does not match the event audience.',
      });
    }

    await pool.query(
      `INSERT INTO event_registrations (user_id, event_id, student_id, college, major, association_member, name, email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [req.user.id, eventId, studentId || null, college || null, major || null, associationMember || 'non-member', name || null, email || null]
    );
    const r = await pool.query(
      'SELECT id, event_id AS "eventId", status, created_at AS "createdAt" FROM event_registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, eventId]
    );
    if (r.rows.length === 0) return res.status(400).json({ error: 'Registration could not be created (you may already have a registration for this event).' });

    if (eventRow.community_id != null) {
      const lr = await pool.query(
        "SELECT id FROM app_users WHERE community_id = $1 AND role IN ('supervisor','community_leader')",
        [eventRow.community_id]
      );
      for (const leader of lr.rows || []) {
        if (leader?.id) {
          await createNotification(
            leader.id,
            'New registration request',
            `A student has requested to join your event "${eventRow.title || eventId}". Approve or reject from the Event Registrations page.`
          );
        }
      }
    }
    await createNotification(
      req.user.id,
      'Pending approval',
      `Your request to join the event "${eventRow.title || eventId}" is pending approval from the community leader.`
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err?.code === '23503') return res.status(404).json({ error: 'Event not found' });
    console.error('registration create error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

/** GET /api/community/event-registrations — registrations for events of the leader's community. Only community leader/supervisor can view. */
app.get('/api/community/event-registrations', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isLeader) {
      return res.status(403).json({ error: 'Only the community leader (or supervisor) for an event can view and manage registration requests.' });
    }
    const status = req.query.status || null;
    const params = [];
    let where = 'WHERE 1=1';
    params.push(user.community_id);
    where += ` AND e.community_id = $${params.length}`;
    if (status) {
      params.push(status);
      where += ` AND er.status = $${params.length}`;
    }
    const q = `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.student_id AS "studentId",
                      er.name, er.college, er.major, er.association_member AS "associationMember",
                      er.status, er.paid_at AS "paidAt", er.created_at AS "createdAt",
                      e.title, e.start_date AS "date", e.start_time AS "time",
                      e.end_date AS "endDate", e.end_time AS "endTime",
                      e.location, e.available_seats AS "availableSeats",
                      c.name AS "communityName",
                      u.email AS "studentEmail"
               FROM event_registrations er
               JOIN events e ON e.id = er.event_id
               LEFT JOIN communities c ON c.id = e.community_id
               JOIN app_users u ON u.id = er.user_id
               ${where}
               ORDER BY er.created_at DESC, er.id DESC`;
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('community registrations list error:', err);
    res.status(500).json({ error: 'Failed to load registrations' });
  }
});

/** GET /api/admin/event-registrations — admin only: all event registrations with college/community info. Optional ?collegeId= & ?communityId= to filter. */
app.get('/api/admin/event-registrations', optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  try {
    const collegeId = req.query.collegeId != null && req.query.collegeId !== '' ? Number(req.query.collegeId) : null;
    const communityId = req.query.communityId != null && req.query.communityId !== '' ? Number(req.query.communityId) : null;
    const params = [];
    let where = 'WHERE 1=1';
    if (collegeId != null && !Number.isNaN(collegeId)) {
      params.push(collegeId);
      where += ` AND col.id = $${params.length}`;
    }
    if (communityId != null && !Number.isNaN(communityId)) {
      params.push(communityId);
      where += ` AND c.id = $${params.length}`;
    }
    const q = `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.student_id AS "studentId",
                      er.name, er.college, er.major, er.association_member AS "associationMember",
                      er.status, er.paid_at AS "paidAt", er.created_at AS "createdAt",
                      e.title, e.start_date AS "date", e.start_time AS "time",
                      e.end_date AS "endDate", e.end_time AS "endTime",
                      e.location, e.available_seats AS "availableSeats",
                      c.name AS "communityName", c.id AS "communityId",
                      col.name AS "collegeName", col.id AS "collegeId",
                      u.email AS "studentEmail"
               FROM event_registrations er
               JOIN events e ON e.id = er.event_id
               LEFT JOIN communities c ON c.id = e.community_id
               LEFT JOIN colleges col ON col.id = c.college_id
               JOIN app_users u ON u.id = er.user_id
               ${where}
               ORDER BY er.created_at DESC, er.id DESC`;
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error('admin event-registrations list error:', err);
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

/** PATCH /api/event-registrations/:id/approve — community leader/supervisor of the event's community, or admin (any registration). Approve only until event capacity. Uses a transaction to prevent race conditions; when the event becomes full, remaining pending/paid registrations are auto-rejected. */
app.patch('/api/event-registrations/:id/approve', optionalAuth, requireAuth, async (req, res) => {
  const user = req.user;
  const isAdmin = isAdminRole(user?.role);
  const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
  if (!isAdmin && !isLeader) {
    return res.status(403).json({ error: 'Only the community leader for this event or an admin can approve registration requests.' });
  }
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid registration id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rr = await client.query(
      `SELECT er.id, er.status, er.event_id, e.community_id, e.available_seats, e.title
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.id = $1
       FOR UPDATE`,
      [id]
    );
    if (rr.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registration not found' });
    }
    const row = rr.rows[0];
    if (!isAdmin && (row.community_id == null || Number(row.community_id) !== Number(user.community_id))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only approve registrations for events of your community.' });
    }
    if (row.status === 'approved') {
      await client.query('ROLLBACK');
      const r = await pool.query(
        `SELECT er.id, er.event_id AS "eventId", er.user_id AS "userId", er.status, er.decided_by AS "decidedBy", er.decided_at AS "decidedAt", e.title FROM event_registrations er JOIN events e ON e.id = er.event_id WHERE er.id = $1`,
        [id]
      );
      return res.json(r.rows[0]);
    }
    if (row.status !== 'paid' && row.status !== 'pending' && row.status !== 'pending_payment') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only pending registrations can be approved.' });
    }

    const capacity = row.available_seats != null ? Number(row.available_seats) : 0;
    if (capacity > 0) {
      const countResult = await client.query(
        'SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = $1 AND status = $2',
        [row.event_id, 'approved']
      );
      const approvedCount = parseInt(countResult.rows[0]?.cnt || '0', 10);
      if (approvedCount >= capacity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Event is full. No more spots available.' });
      }
    }

    await client.query(
      'UPDATE event_registrations SET status = $1, decided_by = $2, decided_at = NOW() WHERE id = $3',
      ['approved', user.id, id]
    );

    if (capacity > 0) {
      const countAfter = await client.query(
        'SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id = $1 AND status = $2',
        [row.event_id, 'approved']
      );
      const approvedAfter = parseInt(countAfter.rows[0]?.cnt || '0', 10);
      if (approvedAfter >= capacity) {
        await client.query(
          `UPDATE event_registrations SET status = 'rejected', decided_by = $1, decided_at = NOW() WHERE event_id = $2 AND status IN ('pending','pending_payment','paid') AND id != $3`,
          [user.id, row.event_id, id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('registration approve error:', err);
    return res.status(500).json({ error: 'Failed to approve registration' });
  } finally {
    client.release();
  }

  try {
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
        `Your registration for the event "${row2.title || row2.eventId}" has been approved. You are confirmed for this event.`
      );
    }
    res.json(row2);
  } catch (err) {
    console.error('registration approve post-commit:', err);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

/** PATCH /api/event-registrations/:id/reject — community leader/supervisor of the event's community, or admin (any registration), can reject. */
app.patch('/api/event-registrations/:id/reject', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisorRole(user?.role)) && user?.community_id != null;
    if (!isAdmin && !isLeader) {
      return res.status(403).json({ error: 'Only the community leader for this event or an admin can reject registration requests.' });
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
      return res.status(403).json({ error: 'You can only reject registrations for events of your community.' });
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

/** GET /api/events/:eventId/reviews — list reviews for an event (for display). */
app.get('/api/events/:eventId/reviews', optionalAuth, async (req, res) => {
  try {
    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });
    const r = await pool.query(
      `SELECT id, event_id AS "eventId", rating, comment, created_at AS "createdAt"
       FROM event_reviews WHERE event_id = $1 ORDER BY created_at DESC`,
      [eventId]
    );
    const list = (r.rows || []).map((row) => ({
      id: row.id,
      eventId: row.eventId,
      rating: row.rating,
      comment: row.comment || '',
      createdAt: row.createdAt,
      name: 'Attendee',
      initials: 'A',
    }));
    res.json(list);
  } catch (err) {
    console.error('get event reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

/** GET /api/events/:eventId/feedback — full feedback list with sentiment for dashboards. */
app.get('/api/events/:eventId/feedback', optionalAuth, async (req, res) => {
  try {
    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });
    const r = await pool.query(
      `SELECT id,
              event_id AS "eventId",
              rating,
              comment,
              COALESCE(override_sentiment, sentiment) AS "sentiment",
              created_at AS "createdAt"
       FROM event_reviews
       WHERE event_id = $1
         AND (is_seeded IS NOT TRUE)
       ORDER BY created_at DESC`,
      [eventId]
    );
    res.json((r.rows || []).map((row) => ({
      id: row.id,
      eventId: row.eventId,
      rating: row.rating,
      comment: row.comment || '',
      sentiment: row.sentiment || 'neutral',
      createdAt: row.createdAt,
    })));
  } catch (err) {
    console.error('get event feedback error:', err);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
});

/** GET /api/events/:eventId/analytics — event performance analytics (ratings, sentiment, engagement, trends). */
app.get('/api/events/:eventId/analytics', optionalAuth, async (req, res) => {
  try {
    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

    // Summary row from view (joins events + registrations + reviews). We only use real (non-seeded) reviews via the view,
    // and then refine rating distribution + trends directly from event_reviews.
    const summaryResult = await pool.query(
      'SELECT id, title, status, community_id AS "communityId", created_by AS "createdBy", start_date AS "startDate", created_at AS "createdAt", registrations_count AS "registrationsCount", reviews_count AS "reviewsCount", average_rating AS "averageRating", positive_reviews AS "positiveReviews", neutral_reviews AS "neutralReviews", negative_reviews AS "negativeReviews" FROM event_analytics_summary WHERE id = $1',
      [eventId]
    );

    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const s = summaryResult.rows[0];

    // Rating distribution 1–5, only from non-seeded reviews.
    const distResult = await pool.query(
      `SELECT rating, COUNT(*) AS count
       FROM event_reviews
       WHERE event_id = $1 AND (is_seeded IS NOT TRUE)
       GROUP BY rating`,
      [eventId]
    );
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distResult.rows) {
      const r = Number(row.rating);
      const c = Number(row.count) || 0;
      if (ratingCounts[r] != null) ratingCounts[r] = c;
    }

    const reviewsCount = Number(s.reviewsCount) || 0;
    const positiveReviews = Number(s.positiveReviews) || 0;
    const neutralReviews = Number(s.neutralReviews) || 0;
    const negativeReviews = Number(s.negativeReviews) || 0;
    const averageRating = Number(s.averageRating) || 0;

    const toPercent = (count) =>
      reviewsCount > 0 ? Math.round((count / reviewsCount) * 100) : 0;

    const sentiment = {
      positive: {
        count: positiveReviews,
        percent: toPercent(positiveReviews),
      },
      neutral: {
        count: neutralReviews,
        percent: toPercent(neutralReviews),
      },
      negative: {
        count: negativeReviews,
        percent: toPercent(negativeReviews),
      },
    };

    // KPIs adapted from old project logic.
    const ratingScore = averageRating > 0 ? Math.min(100, (averageRating / 5) * 100) : 0;
    const sentimentBalance =
      reviewsCount > 0 ? (positiveReviews - negativeReviews) / reviewsCount : 0;
    const sentimentScore = Math.round(((sentimentBalance + 1) / 2) * 100); // map [-1,1] → [0,100]
    const engagementScore =
      reviewsCount <= 0 ? 0 : Math.min(100, (Math.log10(reviewsCount + 1) / Math.log10(21)) * 100);

    const kpiScore = Math.round(
      0.5 * ratingScore + 0.35 * sentimentScore + 0.15 * engagementScore
    );

    let kpiTier = 'No Data';
    if (reviewsCount > 0) {
      if (kpiScore >= 85) kpiTier = 'Excellent';
      else if (kpiScore >= 70) kpiTier = 'Good';
      else if (kpiScore >= 55) kpiTier = 'Needs Improvement';
      else kpiTier = 'Critical';
    }

    // Performance label is derived ONLY from textual feedback sentiment (non-empty comments).
    // It must NOT depend on star ratings.
    const textSentimentResult = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'positive') AS positive_count,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'neutral') AS neutral_count,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'negative') AS negative_count
       FROM event_reviews
       WHERE event_id = $1
         AND (is_seeded IS NOT TRUE)
         AND comment IS NOT NULL
         AND LENGTH(TRIM(comment)) > 0`,
      [eventId]
    );
    const tRow = textSentimentResult.rows[0] || {};
    const textTotal = Number(tRow.total) || 0;
    const textPos = Number(tRow.positive_count) || 0;
    const textNeu = Number(tRow.neutral_count) || 0;
    const textNeg = Number(tRow.negative_count) || 0;
    const safeRatio = (n) => (textTotal > 0 ? n / textTotal : 0);
    const positiveRatio = safeRatio(textPos);
    const neutralRatio = safeRatio(textNeu);
    const negativeRatio = safeRatio(textNeg);

    let performanceLabel = 'No Data';
    if (textTotal > 0) {
      if (positiveRatio >= 0.6) performanceLabel = 'Good';
      else if (negativeRatio >= 0.45) performanceLabel = 'Needs Improvement';
      else performanceLabel = 'Okay';
    }

    // Trend: group by day (non-seeded reviews only) with average rating + sentiment mix.
    const trendResult = await pool.query(
      `SELECT
         date_trunc('day', created_at) AS day,
         COUNT(*) AS reviews_count,
         AVG(rating::numeric) AS avg_rating,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'positive') AS positive_count,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'neutral') AS neutral_count,
         COUNT(*) FILTER (WHERE COALESCE(override_sentiment, sentiment) = 'negative') AS negative_count
       FROM event_reviews
       WHERE event_id = $1 AND (is_seeded IS NOT TRUE)
       GROUP BY date_trunc('day', created_at)
       ORDER BY day`,
      [eventId]
    );

    const trends = trendResult.rows.map((row) => {
      const dayTotal = Number(row.reviews_count) || 0;
      const pos = Number(row.positive_count) || 0;
      const neu = Number(row.neutral_count) || 0;
      const neg = Number(row.negative_count) || 0;
      const toPct = (c) => (dayTotal > 0 ? Math.round((c / dayTotal) * 100) : 0);
      return {
        date: row.day,
        reviewsCount: dayTotal,
        averageRating: row.avg_rating != null ? Number(row.avg_rating) : 0,
        sentiment: {
          positivePercent: toPct(pos),
          neutralPercent: toPct(neu),
          negativePercent: toPct(neg),
        },
      };
    });

    // Keyword extraction (top positive/negative) from real textual feedback only.
    const STOPWORDS_EN = new Set([
      'the','a','an','and','or','but','if','then','else','for','to','of','in','on','at','by','from','with','as','is','are','was','were',
      'be','been','being','it','this','that','these','those','i','we','you','they','he','she','them','his','her','our','your','their',
      'my','me','us','do','did','does','done','not','no','yes','very','really','so','too','just','can','could','should','would','will',
      'about','into','over','under','more','most','less','least','than','also','only','such','etc',
      // domain-noise
      'event','events','good','bad','great','nice','okay',
    ]);
    const STOPWORDS_AR = new Set([
      'في','على','من','الى','إلى','عن','مع','و','او','أو','ثم','لكن','بل','كما','كان','كانت','يكون','تكون','هذا','هذه','ذلك','تلك',
      'هناك','هنا','انا','أنا','نحن','انت','أنت','انتم','أنتم','هو','هي','هم','هن','لك','لكم','لي','لنا','ب','بسبب','حتى','اذا','إذا',
      'لان','لأن','قد','جدا','جداً','جيد','سيئ','سيء','ممتاز',
      // domain-noise
      'فعاليه','فعالية','الفعاليه','الفعالية','حدث','الايفنت','ايفنت',
    ]);
    const NORMALIZE_ARABIC_MAP = [
      [/[\u0622\u0623\u0625]/g, 'ا'], // آ أ إ -> ا
      [/\u0649/g, 'ي'], // ى -> ي
      [/\u0629/g, 'ه'], // ة -> ه
    ];
    const AR_DIACRITICS = /[\u064B-\u065F\u0670]/g;
    const AR_TATWEEL = /\u0640/g;

    function normalizeArabic(s) {
      let out = s;
      out = out.replace(AR_TATWEEL, '').replace(AR_DIACRITICS, '');
      for (const [re, rep] of NORMALIZE_ARABIC_MAP) out = out.replace(re, rep);
      return out;
    }

    function cleanText(s) {
      // keep only letters/spaces; removes punctuation, emojis, symbols, etc.
      return String(s)
        .replace(/[0-9٠-٩]/g, ' ')
        .replace(/[^\p{L}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function collapseExaggeratedRepeats(s, isArabic) {
      // Conservative: collapse runs of 3+ repeated letters.
      // - Arabic: cap to 1 (كووويس → كويس)
      // - English/Latin: cap to 2 (goooood → good)
      const str = String(s || '');
      if (!str) return str;
      if (isArabic) {
        return str.replace(/([\u0600-\u06FF])\1{2,}/g, '$1');
      }
      return str.replace(/([A-Za-z])\1{2,}/g, '$1$1');
    }

    function tokenizeAndCount(text, langHint, counter) {
      const cleaned = cleanText(text);
      if (!cleaned) return;
      const isArabic = langHint === 'ar' || /[\u0600-\u06FF]/.test(cleaned);
      const repeatCollapsed = collapseExaggeratedRepeats(cleaned, isArabic);
      const base = isArabic
        ? normalizeArabic(repeatCollapsed)
        : repeatCollapsed.toLowerCase();
      const tokens = base.split(' ').map((t) => t.trim()).filter(Boolean);
      for (const raw of tokens) {
        const token = raw;
        if (!token) continue;
        // ignore very short tokens (<3) unless meaningful (basic allow-list)
        if (token.length < 3 && !['ai','ui'].includes(token)) continue;
        if (isArabic) {
          if (STOPWORDS_AR.has(token)) continue;
        } else {
          if (STOPWORDS_EN.has(token)) continue;
        }
        counter.set(token, (counter.get(token) || 0) + 1);
      }
    }

    const kwRows = await pool.query(
      `SELECT comment,
              COALESCE(override_sentiment, sentiment) AS s,
              COALESCE(language, 'unknown') AS lang
       FROM event_reviews
       WHERE event_id = $1
         AND (is_seeded IS NOT TRUE)
         AND comment IS NOT NULL
         AND LENGTH(TRIM(comment)) > 0
         AND COALESCE(override_sentiment, sentiment) IN ('positive','negative')
       ORDER BY created_at DESC`,
      [eventId]
    );

    const posCounts = new Map();
    const negCounts = new Map();
    for (const row of kwRows.rows || []) {
      const commentText = row.comment || '';
      const sentimentClass = row.s;
      const lang = (row.lang || '').toString().toLowerCase();
      if (sentimentClass === 'positive') tokenizeAndCount(commentText, lang, posCounts);
      else if (sentimentClass === 'negative') tokenizeAndCount(commentText, lang, negCounts);
    }

    const topN = (m, n = 8) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, n)
        .map(([word, count]) => ({ word, count }));

    const topPositiveKeywords = topN(posCounts, 8);
    const topNegativeKeywords = topN(negCounts, 8);

    res.json({
      eventId: s.id,
      title: s.title,
      status: s.status,
      communityId: s.communityId,
      createdBy: s.createdBy,
      startDate: s.startDate,
      createdAt: s.createdAt,
      registrationsCount: Number(s.registrationsCount) || 0,
      reviewsCount,
      averageRating,
      ratingDistribution: ratingCounts,
      sentiment,
      kpi: {
        score: kpiScore,
        tier: kpiTier,
        ratingScore: Math.round(ratingScore),
        sentimentScore,
        engagementScore: Math.round(engagementScore),
      },
      performanceLabel,
      performanceFromText: {
        totalTextFeedback: textTotal,
        positiveRatio,
        neutralRatio,
        negativeRatio,
      },
      topPositiveKeywords,
      topNegativeKeywords,
      trends,
    });
  } catch (err) {
    console.error('get event analytics error:', err);
    res.status(500).json({ error: 'Failed to load event analytics' });
  }
});

/** POST /api/events/:eventId/reviews — submit a review (auth required; event must be ended; only admin or approved attendees). */
app.post('/api/events/:eventId/reviews', optionalAuth, requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.eventId || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Sign in to submit feedback' });
    const body = req.body || {};
    if (body.rating == null) {
      return res.status(400).json({ error: 'Rating is required' });
    }
    const rating = Number(body.rating);
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating is required and must be 1–5' });
    }
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }
    const eventRow = await pool.query(
      'SELECT id, end_date, end_time FROM events WHERE id = $1',
      [eventId]
    );
    if (eventRow.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const ev = eventRow.rows[0];
    const rawEndDate = ev.end_date;
    let endDate = null;
    if (rawEndDate instanceof Date) {
      endDate = rawEndDate.toISOString().slice(0, 10);
    } else if (typeof rawEndDate === 'string') {
      const trimmed = rawEndDate.trim();
      endDate = trimmed || null;
    }
    const endTime = (ev.end_time || '').trim() || '23:59';
    const endMs = endDate
      ? new Date(endDate.includes('T') ? endDate : `${endDate}T${endTime}`).getTime()
      : 0;
    if (!endDate || Number.isNaN(endMs) || endMs >= Date.now()) {
      return res.status(400).json({ error: 'You can only submit feedback after the event has ended' });
    }
    const regRow = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2 AND status = $3',
      [eventId, userId, 'approved']
    );
    const registrationId = regRow.rows.length > 0 ? regRow.rows[0].id : null;
    const isAdminUser = req.user && isAdminRole(req.user.role);
    if (!isAdminUser && !registrationId) {
      return res.status(400).json({ error: 'You must have an approved registration for this event to submit feedback' });
    }
    // For non-admin users, prevent multiple reviews for the same event.
    if (!isAdminUser) {
      const existing = await pool.query(
        'SELECT id FROM event_reviews WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'You have already submitted feedback for this event' });
      }
    }
    // Sentiment: NLP-driven from comment text when available (rating does NOT control sentiment when a comment exists).
    // Fallback: if comment is empty or NLP fails, use a safe fallback.
    const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8001';
    const NLP_DEBUG = process.env.NLP_DEBUG === '1' || process.env.NLP_DEBUG === 'true';
    const NLP_TIMEOUT_MS = Math.max(500, parseInt(process.env.NLP_TIMEOUT_MS || '3000', 10) || 3000);

    let sentiment = 'neutral';
    let sentimentScore = 0;
    let language = 'unknown';
    let sentimentRaw = null;

    if (comment) {
      try {
        const url = `${NLP_SERVICE_URL.replace(/\/+$/, '')}/analyze-sentiment`;
        const payload = { text: comment };
        if (NLP_DEBUG) console.info('[nlp] request', JSON.stringify({ url, payload }));
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), NLP_TIMEOUT_MS);
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
        sentiment = s;
        sentimentScore = typeof out.score === 'number' && Number.isFinite(out.score) ? out.score : 0;
        language = typeof out.language === 'string' && out.language.trim() ? out.language.trim() : 'unknown';
        sentimentRaw = out;
        if (NLP_DEBUG) console.info('[nlp] response', JSON.stringify(out));
      } catch (e) {
        // Safe fallback: do not derive sentiment from rating when comment exists.
        sentiment = 'neutral';
        sentimentScore = 0;
        language = 'unknown';
        sentimentRaw = { error: String(e?.message || e) };
        console.warn('[nlp] failed, using neutral fallback', { url: NLP_SERVICE_URL, timeoutMs: NLP_TIMEOUT_MS });
      }
    } else {
      // If no comment text exists, keep existing rating-based fallback (rating analytics remain separate).
      sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
      sentimentScore = rating >= 4 ? 0.8 : rating <= 2 ? -0.6 : 0;
      language = 'unknown';
      sentimentRaw = null;
    }
    const id = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const reviewUserId = isAdminUser ? null : userId;
    await pool.query(
      `INSERT INTO event_reviews (id, event_id, rating, comment, sentiment, sentiment_score, sentiment_raw, language, user_id, registration_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, eventId, rating, comment, sentiment, sentimentScore, sentimentRaw, language, reviewUserId, registrationId]
    );
    const r = await pool.query(
      `SELECT id, event_id AS "eventId", rating, comment, created_at AS "createdAt"
       FROM event_reviews WHERE id = $1`,
      [id]
    );
    const row = r.rows[0];
    res.status(201).json({
      id: row.id,
      eventId: row.eventId,
      rating: row.rating,
      comment: row.comment || '',
      createdAt: row.createdAt,
    });
  } catch (err) {
    if (err?.code === '23503') return res.status(404).json({ error: 'Event not found' });
    if (err?.code === '23505') return res.status(409).json({ error: 'You have already submitted feedback for this event' });
    console.error('post event review error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
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
    const row = r.rows[0];
    if (row.picture && typeof row.picture === 'string' && row.picture.startsWith('data:')) {
      const saved = saveBase64ImageToUploads(row.picture, `avatar-${req.user.id}`);
      if (saved) {
        row.picture = saved;
        try {
          await pool.query('UPDATE student_profiles SET picture = $1 WHERE user_id = $2', [saved, req.user.id]);
        } catch (e) {
          console.error('profile get: failed to update picture filename', e);
        }
      }
    }
    res.json(row);
  } catch (err) {
    console.error('profile get error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/** PUT /api/student-profile — upsert current user's profile. */
app.put('/api/student-profile', optionalAuth, requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    let pictureVal = b.picture || null;
    if (pictureVal && typeof pictureVal === 'string' && pictureVal.startsWith('data:')) {
      const saved = saveBase64ImageToUploads(pictureVal, `avatar-${req.user.id}`);
      if (saved) pictureVal = saved;
    }
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
      [req.user.id, b.college || null, b.major || null, b.gpa ?? null, b.creditsEarned ?? null, b.creditsTotal ?? null, pictureVal || null]
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

/** GET /api/admin/events — admin: all events; dean: events of their college; community leader / supervisor: only events of their community.
 * Returns minimal list fields only. Supports ?limit=20&offset=0 (default limit 20). */
app.get('/api/admin/events', optionalAuth, requireAuth, async (req, res) => {
  const t0 = Date.now();
  try {
    const user = req.user;
    const isAdmin = isAdminRole(user?.role);
    const isDean = isDeanRole(user?.role) && user?.college_id != null;
    const isSupervisor = isSupervisorRole(user?.role);
    const isLeader = (isCommunityLeaderRole(user?.role) || isSupervisor) && user?.community_id != null;
    if (!isAdmin && !isDean && !isLeader) return res.status(403).json({ error: 'Only admin, dean, or community leader can list manageable events' });

    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const approvalQueue = req.query.approvalQueue === '1' || req.query.approvalQueue === 'true';
    const pastOnly = req.query.pastOnly === '1' || req.query.pastOnly === 'true';
    let listSelect = approvalQueue ? ADMIN_EVENTS_APPROVAL_SELECT : ADMIN_EVENTS_LIST_SELECT;
    const runQuery = async (select) => {
      let q = select + ' WHERE 1=1';
      const params = [];
      if (approvalQueue) {
        if (isSupervisor && !isAdmin && user?.community_id != null) {
          q += ` AND e.status = 'pending_supervisor' AND e.community_id = $1`;
          params.push(user.community_id);
        } else if (isDean && !isAdmin && user?.college_id != null) {
          q += ` AND e.status IN ('pending_supervisor','pending_dean') AND c.college_id = $1`;
          params.push(user.college_id);
        } else if (isAdmin) {
          q += ` AND e.status IN ('pending_supervisor','pending_dean','pending_admin')`;
        } else if (isLeader) {
          return [];
        } else {
          return [];
        }
      } else {
        if (isLeader && !isAdmin) {
          params.push(user.community_id);
          q += ` AND e.community_id = $${params.length}`;
        } else if (isDean && !isAdmin) {
          params.push(user.college_id);
          q += ` AND c.college_id = $${params.length}`;
        }
        if (pastOnly) {
          // Only include completed events: end date/time strictly before now.
          // If no end_date, fall back to start_date; if no end_time, treat as completed
          // only when the event date is before today.
          q += ` AND (
            COALESCE(e.end_date, e.start_date) < CURRENT_DATE
            OR (
              COALESCE(e.end_date, e.start_date) = CURRENT_DATE
              AND COALESCE(NULLIF(TRIM(e.end_time), ''), '23:59')::time < CURRENT_TIME
            )
          )`;
        }
      }
      q += ' ORDER BY e.created_at DESC, e.id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      const qStart = Date.now();
      const r = await pool.query(q, params);
      const qMs = Date.now() - qStart;
      console.log(`GET /api/admin/events: query ${qMs}ms, returned ${r.rows.length} rows (limit=${limit}, offset=${offset})`);
      return r.rows;
    };

    let rows;
    try {
      rows = await runQuery(listSelect);
    } catch (queryErr) {
      const msg = (queryErr && queryErr.message) ? String(queryErr.message) : '';
      if (/rejected_at_step|requested_changes_at_step|column.*does not exist/i.test(msg)) {
        listSelect = approvalQueue ? ADMIN_EVENTS_APPROVAL_SELECT_LEGACY : ADMIN_EVENTS_LIST_SELECT_LEGACY;
        rows = await runQuery(listSelect);
        rows = rows.map((row) => ({ ...row, rejectedAtStep: null, requestedChangesAtStep: null }));
      } else {
        throw queryErr;
      }
    }

    const totalMs = Date.now() - t0;
    console.log(`GET /api/admin/events: total ${totalMs}ms`);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/admin/events error:', err?.message, err?.stack || err);
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
