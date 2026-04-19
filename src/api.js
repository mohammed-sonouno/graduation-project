/**
 * Backend API client. All data is read/written via these endpoints (nothing in localStorage/sessionStorage).
 * Auth is via httpOnly cookie; send credentials: 'include' on every request.
 *
 * Default to same-origin relative URLs (empty base) so Vite dev *and* `vite preview` proxies
 * forward /api and /uploads → :2000 (see vite.config.js). That avoids HTML index shells being
 * parsed as JSON when the API URL is wrong.
 * Set VITE_API_URL only when the API lives on another origin (production split deploy).
 */
const envApi = import.meta.env.VITE_API_URL;

function resolveApiBase() {
  let base =
    envApi != null && String(envApi).trim() !== '' ? String(envApi).replace(/\/$/, '') : '';
  if (typeof window !== 'undefined' && base) {
    try {
      const resolved = new URL(base, window.location.href);
      if (resolved.origin === window.location.origin) {
        return '';
      }
    } catch {
      /* ignore invalid VITE_API_URL */
    }
  }
  return base;
}

export const API_BASE = resolveApiBase();

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Event image URL: /uploads/<filename>. Fallback when no image: /manage-events-hero.png */
export function eventImageUrl(image) {
  if (!image || typeof image !== 'string') return '/manage-events-hero.png';
  if (image.startsWith('data:')) return image;
  if (image.startsWith('http')) return image;
  const p = image.startsWith('/') ? image.replace(/^\/+/, '') : image;
  const filename = p.split('/').pop() || p;
  return apiUrl('/uploads/' + filename);
}

/** Upload event image (multipart). Returns { filename, url }. Use filename in createEvent/updateEvent. */
export async function uploadEventImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const url = apiUrl('/api/upload-event-image');
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || res.statusText || 'Upload failed'), { status: res.status, data });
  return data;
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
  let data = null;
  if (text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      const err = new Error(
        'The app received a web page instead of API data. Start the backend (npm run server:dev on port 2000), run npm run dev or npm run preview on port 3000 so /api is proxied, leave VITE_API_URL empty (or set it only to a different API host—not the same as the UI).'
      );
      err.status = res.status;
      err.nonJson = true;
      throw err;
    }
    try {
      data = JSON.parse(text);
    } catch {
      const err = new Error(
        res.ok
          ? 'Server returned non-JSON (check API URL and proxy).'
          : `Request failed (${res.status}).`
      );
      err.status = res.status;
      err.nonJson = true;
      throw err;
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Chatbot: persisted on main DB; requires auth cookie. */
export async function postChat({ message, conversationId, majorId }) {
  const body = { message };
  if (conversationId != null && conversationId !== '') {
    body.conversationId = Number(conversationId);
  }
  if (majorId != null && majorId !== '') {
    body.majorId = String(majorId);
  }
  return apiRequest('/api/chat', { method: 'POST', body: JSON.stringify(body) });
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

/** Get reviews for an event (for completed events). */
export async function getEventReviews(eventId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/reviews`);
}

/** Get full feedback list for analytics/dashboard (includes sentiment). */
export async function getEventFeedback(eventId) {
  if (!eventId) {
    throw new Error('eventId is required for getEventFeedback');
  }
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/feedback`);
}

/** Submit feedback for a completed event (requires approved registration). */
export async function submitEventReview(eventId, data) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating: data.rating, comment: data.comment || '' }),
  });
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

/** Request changes (supervisor/dean/admin); event goes to changes_requested, leader notified. */
export async function requestChangesEvent(id, feedback = null) {
  return apiRequest(`/api/events/${encodeURIComponent(id)}/request-changes`, { method: 'PATCH', body: JSON.stringify({ feedback }) });
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

/** Admin only: set this event as the single featured event (unsets all others). */
export async function setEventFeatured(id) {
  const eventId = id != null ? String(id).trim() : '';
  if (!eventId) {
    console.error('setEventFeatured: event id is missing or empty', { id });
    throw Object.assign(new Error('Invalid event id'), { status: 400, data: { error: 'Invalid event id' } });
  }
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/set-featured`, { method: 'PATCH' });
}

export async function getAdminEvents(approvalQueue = false, options = {}) {
  const params = new URLSearchParams();
  if (approvalQueue) params.set('approvalQueue', '1');
  const limit = options.limit != null ? options.limit : 20;
  const offset = options.offset != null ? options.offset : 0;
  if (options.pastOnly) params.set('pastOnly', '1');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiRequest(`/api/admin/events?${params.toString()}`);
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

/** Admin only: all event registrations with college/community info. Optional filters: { collegeId, communityId }. */
export async function getAdminEventRegistrations(filters = {}) {
  const params = new URLSearchParams();
  if (filters.collegeId != null && filters.collegeId !== '') params.set('collegeId', String(filters.collegeId));
  if (filters.communityId != null && filters.communityId !== '') params.set('communityId', String(filters.communityId));
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/admin/event-registrations${q}`);
}

// ---------- Event analytics (from DB) ----------
export async function getEventAnalytics(eventId) {
  if (!eventId) {
    throw new Error('eventId is required for getEventAnalytics');
  }
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/analytics`);
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
