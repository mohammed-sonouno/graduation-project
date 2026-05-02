# Database Checkup — Tables & Requirements

This document lists every table and column the application expects. All are created or altered by migrations in `db/migrations/` (run with `npm run migrate`).

---

## 1. Migration order (`server/run-migrations.js`)

| # | File | Purpose |
|---|------|---------|
| 1 | 002_app_users.sql | Create `app_users` (core) |
| 2 | 003_student_fields.sql | Add profile columns to `app_users` |
| 3 | 003_colleges_majors.sql | Create `colleges`, `majors` + seed |
| 4 | 004_rename_role_user_to_student.sql | Data: role `user` → `student` |
| 5 | 004_events.sql | Create `events` |
| 6 | 005_event_registrations.sql | Create `event_registrations` |
| 7 | 005_must_complete_profile.sql | Add `must_complete_profile` to `app_users` |
| 8 | 006_student_profiles.sql | Create `student_profiles` |
| 9 | 007_notifications.sql | Create `notifications` |
| 10 | 008_seed_events.sql | Seed `events` |
| 11 | 010_module_data.sql | Create `app_module_data` (optional feature) |
| 12 | 011_communities_and_role_assignments.sql | Create `communities`, add `college_id`/`community_id` to `app_users` |
| 13 | 012_ensure_app_users_full_schema.sql | Ensure all `app_users` columns exist (idempotent) |
| 14 | 013_events_community_college.sql | Add `community_id` to `events` |
| 15 | 014_backfill_event_community.sql | Backfill events with community |
| 16 | 016_db_checkup_improvements.sql | PII comments, indexes |
| 17 | 017_drop_chatbot.sql | Drop chatbot views and tables (if present) |

---

## 2. Tables used by the backend (`server/index.js`)

### 2.1 app_users

**Created by:** 002, 003_student_fields, 005_must_complete_profile, 011, 012 (ensures full schema).

| Column | Type | Used for |
|--------|------|----------|
| id | SERIAL PRIMARY KEY | All lookups, JWT, FKs |
| email | VARCHAR(255) NOT NULL UNIQUE | Login, register, Google, complete-registration |
| password_hash | VARCHAR(255) NOT NULL | Login, change-password, complete-registration, complete-profile |
| role | VARCHAR(50) NOT NULL | Auth, permissions, admin, assign-college/assign-community |
| created_at | TIMESTAMPTZ | — |
| first_name | VARCHAR(100) | Profile, /api/auth/me, complete-registration, complete-profile |
| middle_name | VARCHAR(100) | Profile, complete-registration, complete-profile |
| last_name | VARCHAR(100) | Profile, /api/auth/me, complete-registration, complete-profile |
| student_number | VARCHAR(50) UNIQUE | Complete-registration, complete-profile |
| college | VARCHAR(200) | Profile (text) |
| major | VARCHAR(200) | Profile (text) |
| phone | VARCHAR(30) | Profile |
| must_change_password | BOOLEAN | Change-password flow |
| must_complete_profile | BOOLEAN | Complete-profile redirect |
| college_id | INTEGER NULL FK → colleges(id) | Dean assignment, GET /api/auth/me, GET /api/communities |
| community_id | INTEGER NULL FK → communities(id) | Supervisor assignment, GET /api/auth/me, GET /api/communities |

**Indexes:** email, role, student_number; 011 adds unique (community_id), unique (college_id) WHERE role='dean'.

---

### 2.2 colleges

**Created by:** 003_colleges_majors.

| Column | Type | Used for |
|--------|------|----------|
| id | SERIAL PRIMARY KEY | GET /api/colleges, communities FK, majors FK, assign-college |
| name | VARCHAR(255) NOT NULL | GET /api/colleges, GET /api/communities (collegeName) |

**Seed:** 003_colleges_majors inserts 5 rows (Engineering & IT, Medicine & Health, etc.).

---

### 2.3 majors

**Created by:** 003_colleges_majors.

| Column | Type | Used for |
|--------|------|----------|
| id | VARCHAR(100) PRIMARY KEY | GET /api/majors, GET /api/majors/:id |
| name | VARCHAR(255) NOT NULL | GET /api/majors, GET /api/majors/:id |
| college_id | INTEGER NOT NULL FK → colleges(id) | Filter by college |

**Seed:** 003_colleges_majors inserts multiple majors per college.

---

### 2.4 communities

**Created by:** 011_communities_and_role_assignments.

| Column | Type | Used for |
|--------|------|----------|
| id | SERIAL PRIMARY KEY | GET /api/communities, POST /api/communities, app_users.community_id |
| name | VARCHAR(255) NOT NULL | GET /api/communities |
| college_id | INTEGER NOT NULL FK → colleges(id) | Filter by college, UNIQUE(name, college_id) |

**Seed:** 011 inserts 6 communities (e.g. IEEE Student Branch, Software Engineering Club).

---

### 2.5 events

**Created by:** 004_events.

| Column | Type | Used for |
|--------|------|----------|
| id | VARCHAR(100) PRIMARY KEY | All event routes |
| title | VARCHAR(500) NOT NULL | CRUD, list |
| description | TEXT | CRUD |
| category | VARCHAR(100) | CRUD |
| image | VARCHAR(500) | CRUD |
| club_name | VARCHAR(255) | CRUD |
| location | VARCHAR(500) | CRUD |
| start_date | DATE | CRUD, list |
| start_time | VARCHAR(50) | CRUD |
| end_date | DATE | CRUD |
| end_time | VARCHAR(50) | CRUD |
| available_seats | INTEGER | CRUD |
| price | NUMERIC(10,2) | CRUD |
| price_member | NUMERIC(10,2) | CRUD |
| featured | BOOLEAN | CRUD |
| status | VARCHAR(50) | CRUD, filter |
| feedback | TEXT | Reject |
| approval_step | INTEGER | CRUD, approve |
| custom_sections | JSONB | CRUD |
| created_by | INTEGER FK → app_users(id) | INSERT event |
| created_at | TIMESTAMPTZ | — |
| updated_at | TIMESTAMPTZ | — |

**Seed:** 008_seed_events inserts sample events.

---

### 2.6 event_registrations

**Created by:** 005_event_registrations.

| Column | Type | Used for |
|--------|------|----------|
| id | SERIAL PRIMARY KEY | — |
| user_id | INTEGER NOT NULL FK → app_users(id) | GET/POST registrations |
| event_id | VARCHAR(100) NOT NULL FK → events(id) | GET/POST registrations, UNIQUE(user_id, event_id) |
| student_id | VARCHAR(50) | POST body |
| college | VARCHAR(255) | POST body |
| major | VARCHAR(255) | POST body |
| association_member | VARCHAR(50) | POST body |
| name | VARCHAR(255) | POST body |
| email | VARCHAR(255) | POST body |
| created_at | TIMESTAMPTZ | List order |

---

### 2.7 student_profiles

**Created by:** 006_student_profiles.

| Column | Type | Used for |
|--------|------|----------|
| user_id | INTEGER PRIMARY KEY FK → app_users(id) | GET/PUT /api/student-profile |
| college | VARCHAR(255) | GET/PUT |
| major | VARCHAR(255) | GET/PUT |
| gpa | NUMERIC(4,2) | GET/PUT |
| credits_earned | INTEGER | GET/PUT |
| credits_total | INTEGER | GET/PUT |
| picture | TEXT | GET/PUT |
| created_at | TIMESTAMPTZ | — |
| updated_at | TIMESTAMPTZ | PUT upsert |

**Constraint:** One row per user (PRIMARY KEY user_id). Server uses INSERT ... ON CONFLICT (user_id) DO UPDATE.

---

### 2.8 notifications

**Created by:** 007_notifications.

| Column | Type | Used for |
|--------|------|----------|
| id | SERIAL PRIMARY KEY | PATCH read, RETURNING |
| user_id | INTEGER NOT NULL FK → app_users(id) | GET, PATCH, POST |
| title | VARCHAR(255) NOT NULL | POST (e.g. Welcome) |
| message | TEXT | POST |
| read | BOOLEAN | GET, PATCH |
| created_at | TIMESTAMPTZ | GET order |

---

## 3. Tables not used by main server (optional features)

| Table | Migration | Purpose |
|-------|-----------|---------|
| app_module_data | 010_module_data.sql | Generic module key-value store |

This table does not need to exist for auth, events, communities, or profile to work. Migration creates it with `CREATE TABLE IF NOT EXISTS`.

---

## 4. Dependency order

- **app_users** must exist before: events (created_by), event_registrations, student_profiles, notifications, 011 (college_id, community_id).
- **colleges** must exist before: majors (003), communities (011), app_users.college_id (011).
- **communities** must exist before: app_users.community_id (011).
- **events** must exist before: event_registrations (005 adds FK), 008_seed_events.

Current migration order satisfies all dependencies.

---

## 5. How to verify

1. **Run migrations:**  
   `npm run migrate`  
   Expect: `OK:` for each file.

2. **Run DB check script:**  
   `npm run check:db`  
   Verifies that all required tables exist and required columns are present (see `server/check-db.js`).

3. **Start server:**  
   `npm run server`  
   If `app_users` is missing, startup logs: "Run npm run migrate".

---

## 6. Summary

| Table | Required by server | Migration(s) |
|-------|--------------------|-------------|
| app_users | Yes | 002, 003_student_fields, 005_must_complete_profile, 011, 012 |
| colleges | Yes | 003_colleges_majors |
| majors | Yes | 003_colleges_majors |
| communities | Yes | 011 |
| events | Yes | 004_events |
| event_registrations | Yes | 005_event_registrations |
| student_profiles | Yes | 006_student_profiles |
| notifications | Yes | 007_notifications |
| app_module_data | No | 010_module_data |

All required tables and columns are provided by the migrations in the order defined in `server/run-migrations.js`.
