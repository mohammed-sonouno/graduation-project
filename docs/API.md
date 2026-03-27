# API Reference — Frontend Developer Guide

This document describes all backend API endpoints so the frontend can integrate without errors.  
**Base URL:** use relative `/api` in dev (Vite proxy) or set `VITE_API_URL` to the backend origin.  
**Auth:** send `Authorization: Bearer <token>` for endpoints that require authentication.  
**Errors:** failed responses return JSON `{ error: string }` with appropriate HTTP status; always read `res.json()` and use `data?.error` for user-facing messages.

---

## Table of contents

1. [Health](#health)
2. [Auth](#auth)
3. [Colleges & Majors](#colleges--majors)
4. [Communities](#communities)
5. [Events](#events)
6. [Event registrations](#event-registrations)
7. [Student profile](#student-profile)
8. [Notifications](#notifications)
9. [Admin](#admin)

---

## Health

### GET /api/health

**Auth:** None.

**Response:** `200`  
- Body: `{ ok: true, message: "Backend running" }`

---

## Auth

All auth endpoints return JSON. On error they return `{ error: string }` with status 4xx/5xx.

### GET /api/auth/me

**Auth:** Required (Bearer token).

**Response:** `200`  
- Body: `{ user: User }`  
- User shape: `id`, `email`, `role`, `name`, `first_name`, `middle_name`, `last_name`, `student_number`, `college_id`, `community_id`, `collegeName`, `communityName`, `must_change_password`, `must_complete_profile`, `permissions: { admin, dean, supervisor, communityLeader, student, manageEvents, approveEvents, dashboard }`

**Errors:**  
- `401` — Not authenticated

---

### POST /api/auth/register

**Auth:** None.

**Body:** `{ email: string, password: string }`  
- Email must be `@stu.najah.edu` or `@najah.edu` (configurable).

**Response:** `200`  
- Body: `{ user: User, token: string }`

**Errors:**  
- `400` — Email and password required; or email too long; or password too long; or domain not allowed; or password validation failed  
- `409` — An account with this email already exists

---

### POST /api/auth/login

**Auth:** None.  
Legacy password login (for accounts that have a password set).

**Body:** `{ email: string, password: string }`

**Response:** `200`  
- Body: `{ user: User, token: string }`

**Errors:**  
- `400` — Email and password required  
- `401` — Invalid email or password

---

### POST /api/auth/request-login-code

**Auth:** None.  
Sends a 6-digit code to the user's email. User must already exist (register first if new).

**Body:** `{ email: string }`

**Response:** `200`  
- Body: `{ success: true }`  
- In non-production, may include `devCode: string` (the code) for testing.

**Errors:**  
- `400` — Email required; or email too long; or domain not allowed  
- `404` — No account found with this email (ask user to register first)  
- `503` — Database not ready (run migrations)

---

### POST /api/auth/verify-login-code

**Auth:** None.  
Verifies the 6-digit code and signs the user in.

**Body:** `{ email: string, code: string, rememberMe?: boolean }`  
- `code`: exactly 6 digits (non-digits are stripped).  
- `rememberMe`: optional; if true, token has longer expiry (e.g. 30 days).

**Response:** `200`  
- Body: `{ user: User, token: string }`

**Errors:**  
- `400` — Email and a 6-digit code are required  
- `401` — Invalid or expired code

---

### POST /api/auth/google

**Auth:** None.  
Google sign-in. Always sends a 6-digit code to email; does not return a session token directly.

**Body:** `{ credential?: string, access_token?: string }`  
- One of `credential` (ID token) or `access_token` is required.

**Response:** `200`  
- Body (existing user): `{ needsCode: true, email: string }` (+ optional `devCode` in non-production).  
  → Frontend: show code input, then call **POST /api/auth/verify-login-code** with `email`, `code`, `rememberMe`.  
- Body (new user): `{ needsCode: true, newUser: true, email: string, tempToken: string, name?: string, picture?: string }` (+ optional `devCode`).  
  → Frontend: show code input, then call **POST /api/auth/verify-google-new-code** with `email`, `code`, `tempToken`; then redirect to Complete Profile with the same `tempToken` and call **POST /api/auth/complete-registration** (no Bearer token).

**Errors:**  
- `400` — Missing credential or access_token  
- `401` — Invalid Google sign-in; or could not verify Google account  
- `403` — Use a Najah University Google account (@stu.najah.edu or @najah.edu)

---

### POST /api/auth/verify-google-new-code

**Auth:** None.  
For **new** Google users only: verifies the 6-digit code and returns a verified payload so the frontend can proceed to Complete Profile.

**Body:** `{ email: string, code: string, tempToken: string }`  
- `tempToken` is the token returned from **POST /api/auth/google** for new users.

**Response:** `200`  
- Body: `{ verified: true, tempToken: string, email: string, name?: string, picture?: string }`  
- Frontend should store `tempToken` and go to Complete Profile; submit profile via **POST /api/auth/complete-registration** with `tempToken` and form data.

**Errors:**  
- `400` — Email, 6-digit code, and tempToken required  
- `401` — Invalid or expired code; or session expired  
- `403` — Invalid session

---

### POST /api/auth/change-password

**Auth:** Required (Bearer token).

**Body:** `{ oldPassword: string, newPassword: string }`  
- New password must pass server password rules (length, etc.).

**Response:** `200`  
- Body: `{ user: User }`  
- No new token; use existing session.

**Errors:**  
- `400` — Current and new password required; or new password invalid; or account has no password (e.g. Google-only)  
- `401` — Current password is incorrect

---

### POST /api/auth/complete-registration

**Auth:** None.  
Used after **verify-google-new-code** to create the account (new Google user). Send `tempToken` in body.

**Body:**  
- Required: `tempToken: string`, and email must match token.  
- Name/student number are derived from Google (token); user can send: `college`, `major`, `phone`, and optionally `password`.  
- Server expects first name, family name, and student number (from token); optional password.

**Response:** `200`  
- Body: `{ user: User, token: string }`

**Errors:**  
- `400` — Missing tempToken; or first name, family name, and student number required (from token); or password validation failed  
- `401` — Registration link expired or invalid token  
- `403` — Email does not match  
- `409` — Email or student number already registered

---

### POST /api/auth/complete-profile

**Auth:** Required (Bearer token).  
Updates the current user's profile (name, college, major, phone, optional password). Used for “Complete Profile” flow (e.g. Google user who already has an account but must complete profile).

**Body:**  
- `email` must match current user.  
- `first_name`, `father_name`, `third_name`, `family_name`, `student_number`, `college`, `major`, `phone`, `password` (optional).  
- First name, family name, and student number are required.

**Response:** `200`  
- Body: `{ user: User }`

**Errors:**  
- `400` — First name, family name, and student number required; or password validation failed  
- `403` — Cannot update another user's profile  
- `409` — Student number already in use

---

## Colleges & Majors

### GET /api/colleges

**Auth:** None.

**Response:** `200`  
- Body: array of `{ id: number, name: string }`

---

### GET /api/majors

**Auth:** None.

**Query:** `collegeId` (optional) — filter by college.

**Response:** `200`  
- Body: array of `{ id: number, name: string, collegeId: number }`

---

### GET /api/majors/:id

**Auth:** None.

**Response:** `200`  
- Body: `{ id, name, college_id, college_name, college_short_name, required_gpa, high_school_track, degree_type, duration, description, about_text, image_url }` (some fields may be null)

**Errors:**  
- `404` — Major not found

---

### GET /api/programs/:id

**Auth:** None.  
Alias for **GET /api/majors/:id** (same response).

---

## Communities

### GET /api/communities

**Auth:** Optional. If provided, role affects result:  
- Dean: only communities of their college.  
- Supervisor / community_leader: only their one community.  
- Admin or unauthenticated: all, or filter by `college_id`.

**Query:** `college_id` (optional) — filter by college.

**Response:** `200`  
- Body: array of `{ id, name, collegeId, collegeName, leaderId?, leaderEmail?, leaderName? }`

---

### POST /api/communities

**Auth:** Required + Admin only.

**Body:** `{ name: string, collegeId: number, leaderId: number }`  
- Leader must be an existing user with role `supervisor` or `community_leader`.

**Response:** `201`  
- Body: `{ id, name, collegeId }`

**Errors:**  
- `400` — name and collegeId required; or leaderId required; or invalid leaderId; or leader role invalid  
- `404` — Leader user not found  
- `409` — Community with this name already exists in this college

---

### PATCH /api/communities/:id

**Auth:** Required. Admin: any community; Dean: only communities of their college; Community leader: only their community.

**Body:** `{ name: string }`

**Response:** `200`  
- Body: `{ id, name, collegeId, collegeName }`

**Errors:**  
- `400` — name required  
- `403` — Not allowed to edit this community  
- `404` — Community not found  
- `409` — Name already exists in this college

---

## Events

### GET /api/events

**Auth:** Optional.

**Query:** `status` (optional) — e.g. `approved`. If omitted, returns events with status approved/upcoming/past (or null).

**Response:** `200`  
- Body: array of event objects with: `id`, `title`, `description`, `category`, `image`, `clubName`, `location`, `startDate`, `startTime`, `endDate`, `endTime`, `availableSeats`, `price`, `priceMember`, `featured`, `status`, `feedback`, `approvalStep`, `customSections`, `createdAt`, `communityId`, `communityName`, `collegeId`, `collegeName`

---

### GET /api/events/:id

**Auth:** Optional.

**Response:** `200`  
- Body: single event object (same shape as list item).

**Errors:**  
- `404` — Event not found

---

### POST /api/events

**Auth:** Required. Admin, Dean, or community leader/supervisor (leader only for their community).

**Body:**  
- Required: `title`, `description`, `startDate`, `startTime`, `endDate`, `endTime`, `location`, `availableSeats`, `price`, `communityId`.  
- Optional: `id`, `category`, `image`, `clubName`, `priceMember`, `featured`, `status`, `feedback`, `approvalStep`, `customSections` (array).  
- `availableSeats` and `price` must be non-negative numbers.

**Response:** `201`  
- Body: `{ id, title, status, startDate, startTime, createdAt }`

**Errors:**  
- `400` — Missing required fields; or communityId required; or community not found; or invalid community  
- `403` — Only admin/dean/community leader can create; or only for your community/college

---

### PUT /api/events/:id

**Auth:** Required. Same roles as POST; leader/dean can only edit events of their community/college.

**Body:** Same as **POST /api/events** (required fields validated).

**Response:** `200`  
- Body: `{ id, title, status, startDate, startTime }`

**Errors:**  
- `400` — Validation error; or communityId required; or community not found  
- `403` — Not allowed to edit this event  
- `404` — Event not found

---

### PATCH /api/events/:id/approve

**Auth:** Required. Supervisor (for event’s community), Dean (for event’s college), or Admin — depending on approval step.

**Body:** none or empty.

**Response:** `200`  
- Body: `{ id, title, status, approvalStep, ... }` (event object)

**Errors:**  
- `403` — Not allowed to approve at this step  
- `404` — Event not found

---

### PATCH /api/events/:id/reject

**Auth:** Required. Any reviewer (supervisor, dean, admin) can reject.

**Body:** `{ feedback?: string }` (optional feedback message).

**Response:** `200`  
- Body: event object with `status: 'rejected'`, `feedback` set.

**Errors:**  
- `403` — Not allowed to reject  
- `404` — Event not found

---

### DELETE /api/events/:id

**Auth:** Required. Admin, or community leader/supervisor for their community, or dean for their college.

**Response:** `204` No Content (empty body).

**Errors:**  
- `403` — Not allowed to delete  
- `404` — Event not found

---

## Event registrations

### GET /api/event-registrations

**Auth:** Required.

**Response:** `200`  
- Body: array of `{ id, eventId, studentId, college, major, createdAt, title, date, time, image, location }` (joined event fields).

---

### POST /api/event-registrations

**Auth:** Required.  
Registers the **current user** for an event. Student data (name, email, student_id, college, major) is taken from the user’s profile, not from the request body.

**Body:** `{ eventId: string | number, associationMember?: string }`  
- `eventId` required.  
- `associationMember` optional (e.g. `"member"` / `"non-member"`); default `"non-member"`.  
- Extra fields (e.g. `studentId`, `college`, `major`, `name`, `email`) are ignored; server uses profile.

**Response:** `201`  
- Body: `{ id, eventId, createdAt }` or `{ registered: true }`

**Errors:**  
- `400` — eventId required; or cannot register (event draft/pending/rejected); or user profile not found  
- `404` — Event not found

---

## Student profile

### GET /api/student-profile

**Auth:** Required.

**Response:** `200`  
- Body: `{}` or `{ college, major, gpa, creditsEarned, creditsTotal, picture }`

---

### PUT /api/student-profile

**Auth:** Required.  
Upserts the current user’s student profile.

**Body:** `{ college?, major?, gpa?, creditsEarned?, creditsTotal?, picture? }`  
- All optional; camelCase for `creditsEarned`, `creditsTotal`.

**Response:** `200`  
- Body: `{ college, major, gpa, creditsEarned, creditsTotal, picture }` (current state)

---

## Notifications

### GET /api/notifications

**Auth:** Required.

**Response:** `200`  
- Body: array of `{ id, title, message, read, createdAt }`

---

### PATCH /api/notifications/:id/read

**Auth:** Required.

**Response:** `200`  
- Body: `{ ok: true }`

---

### POST /api/notifications

**Auth:** Required.  
Creates a notification for the current user (e.g. welcome). Server may skip creating a duplicate “Welcome” notification.

**Body:** `{ title: string, message?: string }`  
- `title` required.

**Response:** `200` — `{ created: false }` if welcome already existed.  
**Response:** `201` — Body: `{ id, title, message, read, createdAt }`

**Errors:**  
- `400` — title required

---

## Admin

### GET /api/admin/events

**Auth:** Required. Admin: all events; Community leader / supervisor: only events of their community.

**Response:** `200`  
- Body: array of event objects (same shape as **GET /api/events**).

**Errors:**  
- `403` — Only admin or community leader can list manageable events

---

### GET /api/admin/users

**Auth:** Required. Admin: all users; Dean: only users in their college. Community leaders cannot list users.

**Query:** `role` (optional) — filter by role (e.g. `dean`, `supervisor`, `community_leader`, `student`).

**Response:** `200`  
- Body: array of `{ id, email, role, collegeId, communityId, collegeText, collegeName, communityName }`

**Errors:**  
- `403` — Only admin or dean can list users

---

### PATCH /api/admin/users/:id

**Auth:** Required. Admin or Dean (Dean only users in their college). Community leaders cannot call this.

**Body:** `{ role: string, collegeId?: number, communityId?: number }`  
- `role`: one of `admin`, `dean`, `supervisor`, `community_leader`, `student`, `user`.  
- `collegeId` required when setting role to `dean`.  
- `communityId` required when setting role to `supervisor` or `community_leader`.

**Response:** `200`  
- Body: `{ id, email, role, collegeId, communityId, collegeName, communityName }`

**Errors:**  
- `400` — Invalid user id; or role required/invalid; or collegeId/communityId required for role  
- `403` — Only admin can assign admin; or only edit users in your college  
- `404` — User not found

---

### PATCH /api/admin/users/:id/assign-college

**Auth:** Required + Admin only.  
Assigns a **dean** to a college (one dean per college).

**Body:** `{ collegeId: number }`

**Response:** `200`  
- Body: `{ id, email, role, collegeId }`

**Errors:**  
- `400` — collegeId required; or user must have role dean  
- `404` — User not found

---

### PATCH /api/admin/users/:id/assign-community

**Auth:** Required + Admin only.  
Assigns a **supervisor** or **community_leader** to a community (one leader per community).

**Body:** `{ communityId: number }`

**Response:** `200`  
- Body: `{ id, email, role, communityId }`

**Errors:**  
- `400` — communityId required; or user must have role supervisor or community leader  
- `404` — User not found

---

## Frontend usage notes

1. **Auth header:** For any endpoint marked “Required”, send `Authorization: Bearer <token>` (token from login/verify/complete-registration). Store token in localStorage (e.g. key `token`) and send on every request.
2. **Error handling:** All error responses are JSON `{ error: string }`. Parse `res.json()` and show `data?.error` to the user. Check `res.ok` or `res.status` for 4xx/5xx.
3. **CORS:** Backend allows credentials; use `credentials: 'include'` if you call a different origin.
4. **Event registration:** Send only `eventId` and optionally `associationMember`; name, email, student ID, college, major come from the server-side user profile.
5. **Communities query:** Backend uses query `college_id` (snake_case); frontend `getCommunities(collegeId)` in `api.js` maps to `?college_id=`.
6. **DELETE event:** Returns `204` with no body; do not parse JSON on 204.
7. **Complete registration vs complete-profile:** Use **complete-registration** (no auth) for new Google users after verify-google-new-code; use **complete-profile** (with auth) for existing users finishing their profile. Password is optional in both for Google-only accounts.

For DB column ↔ API field names, see `db/API_FIELD_MAPPING.md`.
