# An-Najah University Platform — Complete Documentation

> Last updated: April 2026 | Includes Community System additions

---

## 1. High-Level Overview

### What is this project?

A web platform for An-Najah National University that combines:

- Academic discovery (colleges/majors pages)
- University communities and clubs (communities system — newly added)
- Events lifecycle (create → approve → register → attend → review)
- Admin/staff portal (approvals, registrations, analytics dashboard)

### What problem does it solve?

Centralizes student-facing information and event management into one system with role-based workflows:

- Students browse, register, and review events
- Students create and join university communities
- Staff manage events, approvals, and operations
- Dashboard provides analytics and feedback insights

### Who is it for?

| Role | Description |
|------|-------------|
| `student` / `user` | Default role — browse, register, join communities |
| `community_leader` | Manages a specific community |
| `supervisor` | Supervises a specific community |
| `dean` | Manages a college |
| `admin` | Full access to everything |

---

## 2. Tech Stack

### Frontend
- React 18 + Vite (port 3000)
- React Router v6
- Tailwind CSS (no CSS modules)
- Google OAuth (optional)

### Backend
- Node.js + Express (port 2000, ESM `import/export`)
- PostgreSQL (host: 10.20.10.20, port: 5433, db: "graduation Project")
- JWT authentication via httpOnly cookies (`auth_token`)
- bcrypt (password hashing)
- multer (file uploads → `/uploads/`)
- nodemailer (email login codes)

### NLP Microservice
- Python + FastAPI
- Transformers + Torch (sentiment analysis)
- Currently NOT integrated with backend

---

## 3. Project Structure

```
graduation-project/
├── src/                    # React frontend
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── Navbar.jsx
│   │   ├── ScrollToTop.jsx
│   │   └── CommunityCard.jsx          ← NEW
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useCommunities.js          ← NEW
│   ├── lib/
│   │   └── api.js                     ← API layer (all fetch calls)
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Colleges.jsx
│   │   ├── SingleCollege.jsx
│   │   ├── Majors.jsx
│   │   ├── MajorDetails.jsx
│   │   ├── Events.jsx
│   │   ├── EventDetails.jsx
│   │   ├── Dashboard.jsx
│   │   ├── EventApproval.jsx
│   │   ├── Profile.jsx
│   │   ├── Login.jsx
│   │   ├── AdminLogin.jsx
│   │   ├── Register.jsx
│   │   ├── AdminPortal.jsx
│   │   ├── ManageEvents.jsx
│   │   ├── ManageUsers.jsx
│   │   ├── EventRegistrations.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── CompleteProfile.jsx
│   │   ├── ChangePassword.jsx
│   │   ├── CommunitiesPage.jsx        ← NEW
│   │   ├── Communitydetails.jsx       ← NEW (lowercase d)
│   │   ├── AdminCommunityRequests.jsx ← NEW
│   │   ├── OwnerJoinRequestsPage.jsx  ← NEW
│   │   └── CommunityChatPage.jsx      ← NEW
│   └── App.jsx
│
├── server/
│   ├── index.js                       ← Main server + all inline routes
│   ├── routes/
│   │   ├── communities.js             ← NEW — community + join request routes
│   │   ├── communityChat.js           ← NEW — chat routes
│   │   └── analytics.js
│   ├── db/
│   │   └── pool.js
│   └── uploads/                       ← Uploaded images
│
├── migrations/
│   ├── 001_admin_role.sql
│   ├── 002_app_users.sql
│   ├── 003_colleges_majors.sql
│   └── 004_community_system.sql       ← NEW
│
├── config/
│   └── rules.js
├── vite.config.js
└── .env
```

---

## 4. Architecture

### Request Flow
```
Browser (3000)
    ↓ fetch /api/* with credentials: include
Vite Proxy (vite.config.js)
    ↓ proxies to localhost:2000
Express Server (2000)
    ↓ optionalAuth middleware reads auth_token cookie
    ↓ req.user = decoded JWT
Route Handler
    ↓ pool.query(SQL)
PostgreSQL (10.20.10.20:5433)
    ↓ JSON response
Browser
```

### Auth Flow
- Login → server sets `auth_token` httpOnly cookie
- Every request sends cookie automatically
- `optionalAuth` middleware decodes it → sets `req.user`
- `requireAuth` returns 401 if `req.user` is null
- `requireAdmin` returns 403 if `req.user.role !== 'admin'`

### Vite Proxy Config
```js
// vite.config.js
proxy: {
  '/api':     { target: 'http://localhost:2000', changeOrigin: true },
  '/uploads': { target: 'http://localhost:2000', changeOrigin: true },
}
```

> **Important:** `VITE_API_URL` in `.env` must be empty or removed for local dev.
> If set to `http://localhost:2000`, cookies won't be sent correctly through the proxy.

---

## 5. Database Schema

### Existing Tables

```sql
app_users         -- id SERIAL, email, password_hash, role, college, college_id, community_id, name, ...
colleges          -- id SERIAL, name
majors            -- id VARCHAR, name, college_id
events            -- id SERIAL, title, description, status, community_id, ...
event_registrations
event_reviews
notifications
login_codes
university_topics
university_topic_tags
```

### Community System Tables (004_community_system.sql)

```sql
community_requests (
  id SERIAL PRIMARY KEY,
  requester_id → app_users,
  name VARCHAR(255),
  description TEXT,
  colleges TEXT[],          -- [] = open to all colleges
  image_url VARCHAR(500),
  status CHECK('pending','approved','rejected'),
  reviewed_by → app_users,
  reviewed_at TIMESTAMP,
  created_at, updated_at
)

communities (
  id SERIAL PRIMARY KEY,
  request_id → community_requests,
  owner_id → app_users,
  name VARCHAR(255),
  description TEXT,
  colleges TEXT[],          -- [] = open to all
  image_url VARCHAR(500),
  chat_enabled BOOLEAN DEFAULT true,
  created_at, updated_at
)

community_members (
  id SERIAL PRIMARY KEY,
  community_id → communities,
  user_id → app_users,
  joined_at TIMESTAMP,
  UNIQUE(community_id, user_id)
)

join_requests (
  id SERIAL PRIMARY KEY,
  community_id → communities,
  user_id → app_users,
  status CHECK('pending','approved','rejected'),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP,
  UNIQUE(community_id, user_id)
  -- partial index: only one pending per user per community
)

community_messages (
  id SERIAL PRIMARY KEY,
  community_id → communities,
  sender_id → app_users,
  content TEXT,
  is_deleted BOOLEAN DEFAULT false,   -- soft delete
  created_at TIMESTAMP
)
```

### Run Migration
```powershell
psql -h 10.20.10.20 -p 5433 -U postgres -d "graduation Project" -f migrations/004_community_system.sql
```

---

## 6. Community System — Full Feature Spec

### 6.1 Who Can Do What

| Action | student | community_leader | supervisor | dean | admin |
|--------|---------|-----------------|------------|------|-------|
| View all communities | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request to create community | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create community directly | ❌ | ❌ | ❌ | ❌ | ✅ |
| Join any community | by college | by college | ✅ | ✅ | — |
| View chat (non-member) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete community | ❌ | owner only | ❌ | ❌ | ✅ |
| Approve community requests | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve join requests | owner | owner | ❌ | ❌ | ✅ |

### 6.2 College Restriction Logic

```
if community.colleges is empty → open to everyone
if user.role in ['admin','dean','supervisor'] → always allowed
if user.college matches any of community.colleges → allowed
else → blocked (frontend: disabled button + warning message)
      (backend: 403 error — real security enforced server-side)
```

User college field: `app_users.college` (VARCHAR, stores college name directly)

### 6.3 Membership Status Values

Returned by `GET /api/communities` and `GET /api/communities/:id` as `membership_status`:

| Value | Meaning |
|-------|---------|
| `owner` | User created/owns this community |
| `member` | User is an approved member |
| `pending` | User has a pending join request |
| `none` | User has no connection to this community |

### 6.4 Chat Rules

- `chat_enabled = false` → only owner can send messages, everyone else gets 403
- Messages are soft-deleted (`is_deleted = true`), never hard-deleted
- Deleted messages render as "تم حذف هذه الرسالة" in UI
- Pagination: cursor-based with `?before=<timestamp>&limit=50`

---

## 7. API Endpoints — Community System

### Community Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/community-requests` | any user | Submit request to create community |
| `GET` | `/api/community-requests?status=` | admin | List requests by status |
| `PATCH` | `/api/community-requests/:id/review` | admin | Approve or reject — if approved, creates community + adds owner as member |

### Communities

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/communities` | none | List all (includes membership_status) |
| `GET` | `/api/communities/:id` | none | Single community details |
| `POST` | `/api/communities` | admin only | Create community directly |
| `PATCH` | `/api/communities/:id` | owner/admin | Update name, description, chat_enabled, image |
| `DELETE` | `/api/communities/:id` | owner/admin | Delete community + all related data |

### Members

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/communities/:id/members` | none | List members |
| `DELETE` | `/api/communities/:id/members/:userId` | owner/admin | Remove member |

### Join Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/communities/:id/join-requests` | user | Send join request (college-restricted) |
| `GET` | `/api/communities/:id/join-requests?status=` | owner/admin | List join requests |
| `PATCH` | `/api/communities/:id/join-requests/:requestId` | owner/admin | Approve or reject |

### Chat

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/communities/:id/messages` | member/admin | Load messages (cursor pagination) |
| `POST` | `/api/communities/:id/messages` | member (owner if disabled) | Send message |
| `DELETE` | `/api/communities/:id/messages/:messageId` | sender or owner | Soft delete |

---

## 8. Frontend Pages — Community System

### Routes (App.jsx)

```jsx
<Route path="communities"                          element={<CommunitiesPage />} />
<Route path="communities/:id"                      element={<Communitydetails />} />
<Route path="communities/:id/join-requests"        element={<OwnerJoinRequestsPage />} />
<Route path="communities/:id/chat"                 element={<CommunityChatPage />} />
<Route path="admin-community-requests"             element={<AdminCommunityRequests />} />
```

### Page Descriptions

**CommunitiesPage** (`/communities`)
- Grid of community cards with search + college filter
- "+ طلب إنشاء مجتمع" button → modal
- Admin sees "إنشاء مجتمع مباشر" (skips approval)
- Image upload via file picker (uses existing `uploadEventImage`)

**Communitydetails** (`/communities/:id`)
- Hero with image, name, owner, member count, college badges
- Action button logic: admin → "مشرف النظام" | owner → "أنت المالك" | member → "عضو" | pending → "بانتظار الموافقة" | none → "طلب انضمام"
- Members list (owner sees remove button)
- Chat panel (members + admin only)
- Owner panel: toggle chat, link to join requests, delete community

**OwnerJoinRequestsPage** (`/communities/:id/join-requests`)
- List pending join requests with approve/reject buttons
- Owner or admin access only

**CommunityChatPage** (`/communities/:id/chat`)
- Sidebar: community info + member list + owner chat toggle
- Message area: infinite scroll upward, bubbles (mine right / others left)
- Input: Enter to send, Shift+Enter for newline
- Disabled input banner when chat is off (except owner)

**AdminCommunityRequests** (`/admin-community-requests`)
- Tab bar: pending / approved / rejected
- Expandable rows with full request details
- Approve (creates community) / Reject buttons
- Accessible from admin dropdown in Navbar

---

## 9. Frontend API Functions (src/lib/api.js)

### Key rule
```js
const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim();
// All requests use credentials: 'include'
```

### Community functions added

```js
getCommunities(params)                          // GET /api/communities
getCommunity(id)                                // GET /api/communities/:id
getCommunityMembers(id)                         // GET /api/communities/:id/members
updateCommunity(id, body)                       // PATCH /api/communities/:id
deleteCommunity(id)                             // DELETE /api/communities/:id
removeCommunityMember(communityId, userId)      // DELETE /api/communities/:id/members/:userId

createCommunityRequest(body)                    // POST /api/community-requests
getCommunityRequests(status)                    // GET /api/community-requests
reviewCommunityRequest(id, status)              // PATCH /api/community-requests/:id/review
createCommunityDirect(body)                     // POST /api/communities (admin only)

requestJoinCommunity(communityId)               // POST /api/communities/:id/join-requests
getJoinRequests(communityId, status)            // GET /api/communities/:id/join-requests
reviewJoinRequest(communityId, requestId, status) // PATCH /api/communities/:id/join-requests/:id

getChatMessages(communityId, before)            // GET /api/communities/:id/messages
sendChatMessage(communityId, content)           // POST /api/communities/:id/messages
deleteChatMessage(communityId, messageId)       // DELETE /api/communities/:id/messages/:id
```

---

## 10. Backend Route Registration (server/index.js)

The community routes are registered at the bottom of `server/index.js`, before `app.listen()`:

```js
import communitiesRouter from './routes/communities.js';
import communityChatRouter from './routes/communityChat.js';

// ... all other routes ...

app.use('/api', communitiesRouter(pool));
app.use('/api/communities/:id/messages', communityChatRouter(pool));

app.listen(PORT, ...)
```

> **Important:** `server/index.js` also has an inline `app.get('/api/communities', ...)` around line 1385 that runs **before** the router. This was updated to return all communities to all roles with `membership_status`.

---

## 11. Known Issues & Fixes Applied

| Issue | Fix Applied |
|-------|-------------|
| `SyntaxError: Router already declared` | Removed duplicate `const Router` in communities.js |
| `500` on `GET /api/communities` | Fixed inline route in index.js — removed role-based filtering |
| `401` on `POST /api/community-requests` | Fixed `API_BASE` in api.js — empty string for local dev |
| SQL queries with empty placeholders | Rewrote communities.js and communityChat.js completely |
| Wrong `INSERT INTO communities` columns | Fixed to use `request_id, owner_id, name, description, colleges, image_url` |
| Admin sees join button | Added admin-first check before status logic in Communitydetails.jsx |
| College restriction frontend-only | Added server-side enforcement in `POST /api/communities/:id/join-requests` |
| `Failed to load communities` in ManageUsers | Replaced local `apiFetch` with project's `apiRequest` from lib/api.js |
| Port 3000 already in use | Kill process: `taskkill /PID <pid> /F` |
| Community image not showing | Use `eventImageUrl()` from api.js to build correct URL |
| Search not working | Pass `search` param to `getCommunities()` and handle in backend WHERE clause |

---

## 12. Development Commands

```powershell
# Run everything
npm run dev:all

# Kill port 3000 if occupied
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Run DB migration
psql -h 10.20.10.20 -p 5433 -U postgres -d "graduation Project" -f migrations/004_community_system.sql

# Backup database (run before any risky change)
pg_dump -h 10.20.10.20 -p 5433 -U postgres "graduation Project" > backup_$(Get-Date -Format 'yyyyMMdd_HHmm').sql

# Check community tables exist
psql -h 10.20.10.20 -p 5433 -U postgres -d "graduation Project" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'communit%';"

# Insert test community
psql -h 10.20.10.20 -p 5433 -U postgres -d "graduation Project" -c "INSERT INTO communities (owner_id, name, description, colleges, chat_enabled) VALUES (1, 'IEEE', 'IEEE Student Branch', '{\"Engineering & IT\"}', true);"
```

---

## 13. Navbar Changes

Added to `centerLinks` in `Navbar.jsx`:
```js
{ to: "/communities", label: "Communities" },
```

Added to admin dropdown menu:
```jsx
{admin && (
  <NavLink to="/admin-community-requests">Community Requests</NavLink>
)}
```

Same link added to mobile menu for admin users.

---

## 14. Security Notes

- College restriction is enforced **on the backend** (not just frontend)
- Frontend disables the button for UX, but backend returns `403` if bypassed
- Admin bypasses member check in `requireMember` middleware (communityChat.js)
- Staff roles (`admin`, `dean`, `supervisor`) bypass college restriction
- Soft delete for messages — data is never permanently deleted from DB

---

## 15. Environment Variables

```env
# .env (frontend — Vite)
# Leave empty for local dev — requests go through Vite proxy
VITE_API_URL=

# .env (backend — server)
DATABASE_URL=postgresql://postgres:password@10.20.10.20:5433/graduation%20Project
JWT_SECRET=your-secret
PORT=2000
CORS_ORIGIN=http://localhost:3000
```

---

## 16. Original Limitations (unchanged)

- Roles system is static (email-based for some features)
- NLP service not integrated with backend
- `.env` should not be committed to git
- Python cache files (`__pycache__`) tracked in git

---

## 17. Planned Improvements

- Dynamic role-based system (DB-driven roles + full RBAC)
- Integrate NLP service into event reviews
- Real-time chat (WebSocket / Socket.io) — currently DB-polled
- Community image management (edit/delete after creation)
- Notification system for join request approvals
- Better search with full-text PostgreSQL indexing
- Microservices expansion
- Better analytics + AI insights

---

## 18. Notes for AI Assistance

- Backend uses **cookie-based auth** (NOT Bearer tokens)
- ESM syntax only — `import/export`, never `require()`
- All SQL queries must use `$1`, `$2`, `$3` placeholders
- `app_users.college` is the user's college name (VARCHAR)
- `app_users.college_id` is a foreign key to `colleges` table
- Community image filenames are stored in DB — use `eventImageUrl(filename)` to get full URL
- `server/index.js` has inline routes that may override router routes — check line ~1385 for communities
- Tailwind only on frontend — no CSS module files
- File name: `Communitydetails.jsx` (lowercase `d`) — not `CommunityDetails.jsx`