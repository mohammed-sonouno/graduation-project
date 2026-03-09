/**
 * Backend API client. All data is read/written via these endpoints (nothing in localStorage/sessionStorage).
 * Auth is via httpOnly cookie; send credentials: 'include' on every request.
 */
export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Request a 6-digit login code sent to email. */
export async function requestLoginCode(email) {
  return apiRequest('/api/auth/request-login-code', { method: 'POST', body: JSON.stringify({ email }) });
}

/** Verify 6-digit code and sign in. rememberMe extends session. */
export async function verifyLoginCode(email, code, rememberMe = false) {
  return apiRequest('/api/auth/verify-login-code', {
    method: 'POST',
    body: JSON.stringify({ email, code, rememberMe }),
  });
}

/** Verify 6-digit code for new Google user; returns { verified, sessionId } (pending data stored in DB). */
export async function verifyGoogleNewCode(email, code, tempToken) {
  return apiRequest('/api/auth/verify-google-new-code', {
    method: 'POST',
    body: JSON.stringify({ email, code, tempToken }),
  });
}

/** Load pending Google registration from DB (no sessionStorage). */
export async function getPendingRegistration(sessionId) {
  return apiRequest(`/api/auth/pending-registration?sessionId=${encodeURIComponent(sessionId)}`);
}

/** Admin login with email and password. Returns { user }. */
export async function loginWithPassword(email, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

/** Fetch with credentials (auth via httpOnly cookie). */
export async function apiRequest(path, options = {}) {
  const url = apiUrl(path);
  const headers = { ...options.headers, 'Content-Type': 'application/json' };
  const res = await fetch(url, { credentials: 'include', ...options, headers });
  if (options.raw) return res;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- Colleges & Majors (from DB) ----------
export async function getColleges() {
  return apiRequest('/api/colleges');
}

export async function getMajors(collegeId = null) {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  return apiRequest(`/api/majors${q}`);
}

// ---------- Communities (dean: only their college's; supervisor: only their one) ----------
export async function getCommunities(collegeId = null) {
  const q = collegeId != null ? `?college_id=${encodeURIComponent(collegeId)}` : '';
  return apiRequest(`/api/communities${q}`);
}

export async function createCommunity(body) {
  return apiRequest('/api/communities', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateCommunity(id, body) {
  return apiRequest(`/api/communities/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

// ---------- Admin: users and role assignments ----------
export async function getAdminUsers(role = null) {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiRequest(`/api/admin/users${q}`);
}

export async function assignDeanToCollege(userId, collegeId) {
  return apiRequest(`/api/admin/users/${userId}/assign-college`, {
    method: 'PATCH',
    body: JSON.stringify({ collegeId }),
  });
}

export async function assignSupervisorToCommunity(userId, communityId) {
  return apiRequest(`/api/admin/users/${userId}/assign-community`, {
    method: 'PATCH',
    body: JSON.stringify({ communityId }),
  });
}

// ---------- Events (from DB) ----------
export async function getEvents(status = null) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/api/events${q}`);
}

export async function getEvent(id) {
  return apiRequest(`/api/events/${encodeURIComponent(id)}`);
}

export async function createEvent(body) {
  return apiRequest('/api/events', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateEvent(id, body) {
  return apiRequest(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function approveEvent(id) {
  return apiRequest(`/api/events/${id}/approve`, { method: 'PATCH' });
}

export async function rejectEvent(id, feedback = null) {
  return apiRequest(`/api/events/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ feedback }) });
}

export async function deleteEvent(id) {
  const res = await fetch(apiUrl(`/api/events/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (res.status === 204) return;
  const data = await res.json().catch(() => ({}));
  const err = new Error(data?.error || res.statusText);
  err.status = res.status;
  err.data = data;
  throw err;
}

export async function getAdminEvents() {
  return apiRequest('/api/admin/events');
}

// ---------- Event registrations (from DB) ----------
export async function getEventRegistrations() {
  return apiRequest('/api/event-registrations');
}

export async function registerForEvent(payload) {
  return apiRequest('/api/event-registrations', { method: 'POST', body: JSON.stringify(payload) });
}

/** Community leader/supervisor: list registrations for their community's events. */
export async function getCommunityEventRegistrations(status = null) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/api/community/event-registrations${q}`);
}

/** Mark a registration as paid (community leader/supervisor/admin). */
export async function markRegistrationPaid(id) {
  return apiRequest(`/api/event-registrations/${id}/mark-paid`, { method: 'PATCH' });
}

/** Approve a registration (must be paid first; subject to event capacity). */
export async function approveRegistration(id) {
  return apiRequest(`/api/event-registrations/${id}/approve`, { method: 'PATCH' });
}

/** Reject a registration. */
export async function rejectRegistration(id) {
  return apiRequest(`/api/event-registrations/${id}/reject`, { method: 'PATCH' });
}

// ---------- Student profile (from DB) ----------
export async function getStudentProfile() {
  return apiRequest('/api/student-profile');
}

export async function saveStudentProfile(data) {
  return apiRequest('/api/student-profile', { method: 'PUT', body: JSON.stringify(data) });
}

// ---------- Notifications (from DB) ----------
export async function getNotifications() {
  return apiRequest('/api/notifications');
}

export async function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function createWelcomeNotification() {
  return apiRequest('/api/notifications', {
    method: 'POST',
    body: JSON.stringify({ title: 'Welcome', message: 'You are logged in to An-Najah National University.' }),
  });
}
