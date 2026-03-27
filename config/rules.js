/**
 * Single source of app rules.
 *
 * Start with the full set above; to have fewer rules, change:
 *   - REQUIRE_NAJAH_EMAIL = false  → allow any email (no domain check)
 *   - ALLOWED_EMAIL_DOMAINS = []   → same if REQUIRE_NAJAH_EMAIL is true
 *   - MIN_PASSWORD_LENGTH = 1      → relax password length (e.g. for dev)
 * Server and frontend (Login, Register) read from this file only.
 *
 * Roles: stored per user in app_users.role in the DB; the website reads the user's role (via /api/auth/me)
 * to decide what to show (admin panel, communities, profile, etc.).
 */

// --- Roles & permissions (admin has full access to everything you add)
/** The role value for administrators. Admin has all permissions (current and future). */
export const ADMIN_ROLE = 'admin';

/** The role value for Dean Of A College. Stored as 'dean' in DB; display as DEAN_DISPLAY_NAME in UI. */
export const DEAN_ROLE = 'dean';
/** Display name for the dean role in the UI. */
export const DEAN_DISPLAY_NAME = 'Dean Of A College';

/** The role value for Supervisor. Stored as 'supervisor' in DB; display as SUPERVISOR_DISPLAY_NAME in UI. */
export const SUPERVISOR_ROLE = 'supervisor';
/** Display name for the supervisor role in the UI. */
export const SUPERVISOR_DISPLAY_NAME = 'Supervisor';

/** The role value for Community Leader. Stored as 'community_leader' in DB; display as COMMUNITY_LEADER_DISPLAY_NAME in UI. */
export const COMMUNITY_LEADER_ROLE = 'community_leader';
/** Display name for the community leader role in the UI. */
export const COMMUNITY_LEADER_DISPLAY_NAME = 'Community Leader';

/** The role value for Student. Stored as 'student' in DB; display as STUDENT_DISPLAY_NAME in UI. Role 'user' is also treated as student in the UI. */
export const STUDENT_ROLE = 'student';
/** Display name for the student role in the UI. */
export const STUDENT_DISPLAY_NAME = 'Student';

/** Whether this role has full admin permissions (manage events, approve events, dashboard, and any future admin feature). */
export function isAdminRole(role) {
  return role === ADMIN_ROLE;
}

/** Whether this role is Dean Of A College. */
export function isDeanRole(role) {
  return role === DEAN_ROLE;
}

/** Whether this role is Supervisor. */
export function isSupervisorRole(role) {
  return role === SUPERVISOR_ROLE;
}

/** Whether this role is Community Leader. */
export function isCommunityLeaderRole(role) {
  return role === COMMUNITY_LEADER_ROLE;
}

/** Whether this role is Student (explicit 'student' role). */
export function isStudentRole(role) {
  return role === STUDENT_ROLE;
}

// --- Auth / registration
/** Allowed email domains for sign-up and login. Empty array = allow any email when REQUIRE_NAJAH_EMAIL is false. */
export const ALLOWED_EMAIL_DOMAINS = ['@stu.najah.edu', '@najah.edu'];

/** Minimum password length (registration and login validation). */
export const MIN_PASSWORD_LENGTH = 8;

/** Password must contain at least one uppercase letter. */
export const PASSWORD_NEEDS_UPPERCASE = true;
/** Password must contain at least one lowercase letter. */
export const PASSWORD_NEEDS_LOWERCASE = true;
/** Password must contain at least one digit. */
export const PASSWORD_NEEDS_NUMBER = true;
/** Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:'",.<>?/). */
export const PASSWORD_NEEDS_SPECIAL = true;

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/\\]/;

/**
 * Validate password against rules. Returns { valid: boolean, errors: string[] }.
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'] };
  }
  const errors = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`At least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (PASSWORD_NEEDS_UPPERCASE && !UPPERCASE_REGEX.test(password)) {
    errors.push('One uppercase letter');
  }
  if (PASSWORD_NEEDS_LOWERCASE && !LOWERCASE_REGEX.test(password)) {
    errors.push('One lowercase letter');
  }
  if (PASSWORD_NEEDS_NUMBER && !NUMBER_REGEX.test(password)) {
    errors.push('One number');
  }
  if (PASSWORD_NEEDS_SPECIAL && !SPECIAL_REGEX.test(password)) {
    errors.push('One special character (!@#$%^&* etc.)');
  }
  return { valid: errors.length === 0, errors };
}

/** Human-readable list of password rules for UI. */
export function getPasswordRules() {
  const rules = [`At least ${MIN_PASSWORD_LENGTH} characters`];
  if (PASSWORD_NEEDS_UPPERCASE) rules.push('One uppercase letter');
  if (PASSWORD_NEEDS_LOWERCASE) rules.push('One lowercase letter');
  if (PASSWORD_NEEDS_NUMBER) rules.push('One number');
  if (PASSWORD_NEEDS_SPECIAL) rules.push('One special character (!@#$%^&* etc.)');
  return rules;
}

/** If false, any email is allowed (domain check skipped). Set to false for "less" rules. */
export const REQUIRE_NAJAH_EMAIL = true;

// --- Event registration (event sign-up form)
export const MIN_STUDENT_ID_LENGTH = 8;
export const REVIEW_MAX_CHARS = 500;

// --- Event creation (manage events)
export const EVENT_REQUIRED_FIELDS = [
  'title', 'description', 'startDate', 'startTime', 'endDate', 'endTime',
  'location', 'availableSeats', 'price',
];

// --- Helpers
export function getAllowedDomains() {
  return REQUIRE_NAJAH_EMAIL ? ALLOWED_EMAIL_DOMAINS : [];
}

export function isEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;
  const domains = getAllowedDomains();
  if (domains.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  return domains.some((d) => normalized.endsWith(d.toLowerCase()));
}

/** Message for UI when email is not allowed (e.g. "Please use ... @stu.najah.edu or @najah.edu"). */
export function getEmailRuleMessage() {
  const domains = getAllowedDomains();
  if (domains.length === 0) return '';
  return `Please use an email ending with ${domains.join(' or ')}.`;
}
