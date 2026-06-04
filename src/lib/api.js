/**
 * Backend API client. All data is read/written via these endpoints (nothing in localStorage/sessionStorage).
 * Auth is via httpOnly cookie; send credentials: 'include' on every request.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim();

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
  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers,
  });
  if (options.raw) return res;
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const snippet = res.status;
      if (!res.ok) {
        const err = new Error(
          text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')
            ? `Request failed (${snippet}). The server returned a page instead of JSON — is the API URL correct and the backend running?`
            : (text.slice(0, 200) || `Request failed (${snippet})`)
        );
        err.status = res.status;
        throw err;
      }
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

// ---------- Colleges & Majors (from DB) ----------
export async function getColleges() {
  return apiRequest('/api/colleges');
}

export async function getMajors(collegeId = null) {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  return apiRequest(`/api/majors${q}`);
}

// ---------- Communities ----------
export async function getCommunities(params = {}) {
  const q = new URLSearchParams();
  if (params.college) q.set('college', params.college);
  if (params.kind) q.set('kind', params.kind);
  if (params.search)  q.set('search',  params.search);
  if (params.page)    q.set('page',    String(params.page));
  if (params.limit)   q.set('limit',   String(params.limit));
  if (params.includeMyRequestCards) q.set('includeMyRequestCards', String(params.includeMyRequestCards));
  return apiRequest(`/api/communities${q.toString() ? '?' + q.toString() : ''}`);
}

export async function getCommunity(id) {
  return apiRequest(`/api/communities/${encodeURIComponent(id)}`);
}

export async function getCommunityMembers(id) {
  return apiRequest(`/api/communities/${encodeURIComponent(id)}/members`);
}

export async function updateCommunity(id, body) {
  return apiRequest(`/api/communities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Admin: POST /api/communities — legacy { name, collegeId, leaderId } or direct { name, description, colleges, image_url }. */
export async function createCommunity(body) {
  return apiRequest('/api/communities', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createCommunityDirect(body) {
  return createCommunity(body);
}

export async function deleteCommunity(id) {
  return apiRequest(`/api/communities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function removeCommunityMember(communityId, userId) {
  return apiRequest(
    `/api/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
}

// ---------- Community requests ----------
export async function getCommunityRequests(status = 'pending') {
  return apiRequest(`/api/community-requests?status=${encodeURIComponent(status)}`);
}

export async function createCommunityRequest(body) {
  return apiRequest('/api/community-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Current user's pending/rejected community creation requests (for list cards). Optional college / search. */
export async function getMyCommunityRequestCards(params = {}) {
  const q = new URLSearchParams();
  if (params.college) q.set('college', params.college);
  if (params.search) q.set('search', params.search);
  return apiRequest(`/api/community-requests/mine${q.toString() ? `?${q.toString()}` : ''}`);
}

/** Requester hides a pending/rejected request from their list (soft dismiss). */
export async function dismissCommunityRequest(requestId) {
  return apiRequest(`/api/community-requests/${encodeURIComponent(requestId)}/dismiss`, {
    method: 'POST',
  });
}

export async function reviewCommunityRequest(id, status) {
  return apiRequest(`/api/community-requests/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---------- Join requests ----------
export async function requestJoinCommunity(communityId) {
  return apiRequest(`/api/communities/${encodeURIComponent(communityId)}/join-requests`, {
    method: 'POST',
  });
}

export async function getJoinRequests(communityId, status = 'pending') {
  return apiRequest(
    `/api/communities/${encodeURIComponent(communityId)}/join-requests?status=${encodeURIComponent(status)}`
  );
}

export async function reviewJoinRequest(communityId, requestId, status) {
  return apiRequest(
    `/api/communities/${encodeURIComponent(communityId)}/join-requests/${encodeURIComponent(requestId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
}

// ---------- Community chat ----------
export async function getChatMessages(communityId, before = null, limit = null) {
  const params = new URLSearchParams();
  if (before != null && before !== '') params.set('before', String(before));
  if (limit != null) params.set('limit', String(limit));
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/communities/${encodeURIComponent(communityId)}/messages${q}`);
}

export async function sendChatMessage(communityId, content) {
  return apiRequest(`/api/communities/${encodeURIComponent(communityId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteChatMessage(communityId, messageId) {
  return apiRequest(
    `/api/communities/${encodeURIComponent(communityId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' }
  );
}

// ---------- Admin: users and role assignments ----------
export async function getAdminUsers(role = null) {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiRequest(`/api/admin/users${q}`);
}

export async function createAdminInvitedUser(email) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function deleteAdminUser(userId) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
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
  if (options.associationOnly) params.set('associationOnly', '1');
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