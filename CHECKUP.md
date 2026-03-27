# Full Project Checkup

**Date:** March 2025  
**Scope:** Database, backend routes, frontend, config.

---

## 1. Database

### 1.1 Migrations (run order in `server/run-migrations.js`)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `002_app_users.sql` | Core users table: id, email, password_hash, role (default `user`), created_at |
| 2 | `003_student_fields.sql` | app_users: first_name, middle_name, last_name, student_number, college, major, phone, must_change_password |
| 3 | `003_colleges_majors.sql` | Tables: colleges (id, name), majors (id, name, college_id); seed data |
| 4 | `004_rename_role_user_to_student.sql` | Data: role `user` → `student` |
| 5 | `004_events.sql` | Table: events (full schema for CRUD, status, approval_step, etc.) |
| 6 | `005_event_registrations.sql` | Table: event_registrations (user_id, event_id, …), UNIQUE(user_id, event_id) |
| 7 | `005_must_complete_profile.sql` | app_users: must_complete_profile column |
| 8 | `006_student_profiles.sql` | Table: student_profiles (user_id PK, college, major, gpa, credits_*, picture) |
| 9 | `007_notifications.sql` | Table: notifications (user_id, title, message, read) |
| 10 | `008_seed_events.sql` | Seed events (optional) |
| 11 | `010_module_data.sql` | Module data (optional) |
| 12 | `011_communities_and_role_assignments.sql` | communities table; app_users: college_id, community_id; UNIQUE(community_id), UNIQUE(college_id) WHERE role='dean' |
| 13 | `012_ensure_app_users_full_schema.sql` | Ensures all app_users columns exist (idempotent) |
| 14 | `013_events_community_college.sql` | events.community_id |
| 15 | `014_backfill_event_community.sql` | Backfill events with community |
| 16 | `016_db_checkup_improvements.sql` | PII comments, indexes |
| 17 | `017_drop_chatbot.sql` | Drop chatbot tables/views if present |

**Note:** `001_admin_role.sql` is for PostgreSQL cluster role "admin", not app users; it is **not** in the run list. App admin is created at runtime by `ensureAdminUser()` in `server/index.js`.

### 1.2 Tables used by the backend

| Table | Used by |
|-------|---------|
| app_users | Auth (login, register, Google, complete-registration, complete-profile), /api/auth/me, optionalAuth, admin users, assign-college/assign-community |
| colleges | GET /api/colleges, communities (FK), assign-college |
| majors | GET /api/majors, GET /api/majors/:id |
| communities | GET/POST /api/communities, assign-community, app_users.community_id |
| events | GET/POST/PUT/PATCH/DELETE /api/events, admin/events |
| event_registrations | GET/POST /api/event-registrations |
| student_profiles | GET/PUT /api/student-profile |
| notifications | GET/PATCH/POST /api/notifications |

### 1.3 app_users schema (after 012)

- **Core:** id, email, password_hash, role, created_at  
- **Profile:** first_name, middle_name, last_name, student_number, college, major, phone  
- **Flags:** must_change_password, must_complete_profile  
- **Role links:** college_id (dean), community_id (supervisor)  

**Roles in DB:** `admin`, `student`, `dean`, `supervisor`, `community_leader` (legacy `user` treated as student in app).

---

## 2. Backend (server/index.js)

### 2.1 Port

- **Default PORT:** `3001` (so Vite on 3000 can proxy /api to backend without conflict).
- Override with `PORT` in `.env` if needed.

### 2.2 All routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Health check |
| GET | /api/auth/me | optionalAuth | Current user from DB (with permissions) |
| POST | /api/auth/register | — | Register (email + password → student) |
| POST | /api/auth/login | — | Login (email + password) |
| POST | /api/auth/google | — | Google sign-in (or pendingRegistration) |
| POST | /api/auth/change-password | requireAuth | Change password (old + new) |
| POST | /api/auth/complete-registration | — | Complete Google sign-up (tempToken + form) |
| POST | /api/auth/complete-profile | requireAuth | Complete profile (email/password flow) |
| GET | /api/colleges | — | List colleges |
| GET | /api/communities | optionalAuth | List communities (dean/supervisor filtered) |
| POST | /api/communities | requireAuth + requireAdmin | Create community |
| GET | /api/majors | — | List majors (?collegeId= optional) |
| GET | /api/majors/:id | — | Single major |
| GET | /api/programs/:id | — | Alias for major by id |
| GET | /api/events | optionalAuth | List events (?status= optional) |
| GET | /api/events/:id | optionalAuth | Single event |
| POST | /api/events | requireAuth + requireAdmin | Create event |
| PUT | /api/events/:id | requireAuth + requireAdmin | Update event |
| PATCH | /api/events/:id/approve | requireAuth + requireAdmin | Approve event |
| PATCH | /api/events/:id/reject | requireAuth + requireAdmin | Reject event |
| DELETE | /api/events/:id | requireAuth + requireAdmin | Delete event |
| GET | /api/event-registrations | requireAuth | Current user's registrations |
| POST | /api/event-registrations | requireAuth | Register for event |
| GET | /api/student-profile | requireAuth | Current user's student profile |
| PUT | /api/student-profile | requireAuth | Upsert student profile |
| GET | /api/notifications | requireAuth | Current user's notifications |
| PATCH | /api/notifications/:id/read | requireAuth | Mark read |
| POST | /api/notifications | requireAuth | Create (e.g. welcome) |
| GET | /api/admin/events | requireAuth + requireAdmin | All events (any status) |
| GET | /api/admin/users | requireAuth + requireAdmin | List users (?role= optional) |
| PATCH | /api/admin/users/:id/assign-college | requireAuth + requireAdmin | Assign dean to college |
| PATCH | /api/admin/users/:id/assign-community | requireAuth + requireAdmin | Assign supervisor to community |

### 2.3 Auth and roles

- **optionalAuth:** Loads user from DB by JWT `userId`; sets `req.user` or null.
- **requireAuth:** 401 if not logged in.
- **requireAdmin:** 403 if not `isAdminRole(req.user.role)`.
- **withPermissions(user):** Adds `permissions` from `user.role` (admin, dean, supervisor, communityLeader, student, manageEvents, approveEvents, dashboard).
- All auth routes read/write **app_users**; DB is source of truth for roles and profile.

### 2.4 Missing backend (intentional)

- **Forgot password:** No reset-by-email API. Frontend `/forgot-password` is a placeholder that directs users to contact IT. No backend route required.

---

## 3. Frontend

### 3.1 Vite and API

- **Dev:** Vite runs on port **3000**; proxy `/api` → `http://localhost:3001`.
- **API base:** `api.js` uses `VITE_API_URL` or '' (so dev uses proxy).

### 3.2 App routes (App.jsx)

| Path | Page | Notes |
|------|------|-------|
| / | Home | |
| /colleges | Colleges | getColleges() |
| /colleges/:id | SingleCollege | getColleges, getMajors(id) |
| /majors | Majors | getColleges, getMajors() |
| /majors/:id | MajorDetails | GET /api/programs/:id |
| /events | Events | getEvents() |
| /events/:id | EventDetails | getEvent, getColleges, getMajors, registerForEvent |
| /dashboard | Dashboard | Admin; getAdminEvents, getColleges |
| /event-approval | EventApproval | Admin |
| /admin | AdminPortal | Admin |
| /admin/assignments | AdminAssignments | Admin; users, assign dean/supervisor |
| /manage-events | ManageEvents | Admin |
| /communities | Communities | getCommunities, getColleges |
| /profile | Profile | useAuth |
| /login | Login | /api/auth/login, /api/auth/google |
| /register | Register | /api/auth/register |
| /forgot-password | ForgotPassword | Placeholder (no API) |
| /complete-profile | CompleteProfile | /api/auth/complete-registration or complete-profile |
| /change-password | ChangePassword | /api/auth/change-password |
| * | NotFound | |

### 3.3 Auth and role usage

- **AuthProvider** (AuthContext): On load, if token exists, fetches **GET /api/auth/me** and sets user from DB; otherwise clears user/token.
- **Role checks:** `src/utils/permissions.js` uses `user.role` and `user.permissions` (from API) — isAdmin, isDean, isSupervisor, isCommunityLeader, isStudent.
- **Usage:** Navbar (role label, admin/communities links), Login redirects (admin → /admin, dean/supervisor/community_leader → /communities, student → /profile), Dashboard/EventApproval/ManageEvents/AdminPortal/AdminAssignments (admin-only), Communities (role-based content).

### 3.4 API client (api.js)

All listed endpoints have matching functions: getColleges, getMajors, getCommunities, createCommunity, getAdminUsers, assignDeanToCollege, assignSupervisorToCommunity, getEvents, getEvent, createEvent, updateEvent, approveEvent, rejectEvent, deleteEvent, getAdminEvents, getEventRegistrations, registerForEvent, getStudentProfile, saveStudentProfile, getNotifications, markNotificationRead, createWelcomeNotification. Login/Register/Google/complete-registration/complete-profile/change-password/me use fetch directly with apiUrl().

---

## 4. Config

### 4.1 config/rules.js

- Email: `isEmailAllowed` (e.g. @najah.edu, @stu.najah.edu), `MIN_PASSWORD_LENGTH`, `validatePassword`.
- Roles: ADMIN_ROLE, DEAN_ROLE, SUPERVISOR_ROLE, COMMUNITY_LEADER_ROLE, STUDENT_ROLE; helpers isAdminRole, isDeanRole, etc.
- Roles are stored per user in **app_users.role**; the site reads the user's role via **/api/auth/me** to decide what to show.

### 4.2 Environment

- **.env.example:** Documents VITE_GOOGLE_CLIENT_ID, VITE_API_URL (proxy 3001), DATABASE_URL.
- **Server:** DATABASE_URL or default PostgreSQL connection string.

---

## 5. Fixes applied in this checkup

1. **Server port:** Default PORT changed from `3000` to `3001` so it does not conflict with Vite (port 3000). Proxy in `vite.config.js` already targeted 3001.
2. **.env.example:** Comment updated to say Vite proxies /api to `http://localhost:3001` (was 3000).

---

## 6. Summary

| Area | Status |
|------|--------|
| DB migrations | Ordered and consistent; 012 ensures full app_users schema. |
| Backend routes | All auth, colleges, majors, communities, events, registrations, student profile, notifications, admin routes present and aligned with frontend. |
| Frontend routes | All pages have routes; ForgotPassword is placeholder (no backend). |
| API ↔ backend | All api.js calls and direct fetch auth calls have corresponding server routes. |
| Auth & roles | User and role from DB via /api/auth/me; frontend uses permissions.js and role-based redirects/UI. |
| Port / proxy | Backend 3001, Vite 3000, proxy /api → 3001; .env.example updated. |

Run migrations: `npm run migrate`.  
Run backend: `npm run server` (or `npm run server:dev`).  
Run frontend: `npm run dev`.  
Then open http://localhost:3000; API calls go to backend via proxy.
