PROJECT: An-Najah University Platform

TYPE:
Full-stack web platform for university services

CORE FEATURES:
- Academic browsing (colleges, majors)
- Events system (create → approve → register → review)
- Communities system (create request → admin approval → join → chat)
- Admin dashboard (management + analytics)

TECH STACK:
- Frontend: React 18 + Vite + Tailwind
- Backend: Node.js + Express (ESM)
- Database: PostgreSQL
- Auth: JWT via httpOnly cookies
- Extras: multer, nodemailer, FastAPI (NLP - not integrated)

ROLES:
- student: browse, join communities, register events
- community_leader: manage own community
- supervisor / dean: elevated access
- admin: full control

COMMUNITIES SYSTEM:
- Users request community → admin approves → community created
- Join restricted by college (server-side enforced)
- membership_status: owner | member | pending | none
- Features:
  - members management
  - join requests (approve/reject)
  - chat system (DB-based, not real-time)
  - chat toggle (owner can disable)

AUTH FLOW:
- Login → sets auth_token cookie
- Requests include cookies automatically
- Middleware:
  - optionalAuth → attach user if exists
  - requireAuth → block unauthenticated
  - requireAdmin → admin-only

ARCHITECTURE:
Frontend (3000) → Vite Proxy → Backend (2000) → PostgreSQL

IMPORTANT NOTES:
- Cookie-based auth (NOT Bearer tokens)
- VITE_API_URL must be empty in local dev (use proxy)
- Some routes are inline in server/index.js (may override routers)
- NLP service exists but not connected

LIMITATIONS:
- Static roles (no full RBAC)
- Chat not real-time
- NLP not integrated

PLANNED:
- Full RBAC
- WebSocket chat
- NLP integration
- Notifications system