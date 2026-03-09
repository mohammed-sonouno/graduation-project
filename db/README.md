# Project PostgreSQL data

Database files for this project are stored in this folder.

- **Port:** `5433` (so it doesn’t conflict with a main PostgreSQL on 5432)
- **Database name:** `Graduation Project`
- **User:** `postgres` (no password by default for this local cluster)

**Start server (from project root):**
```powershell
.\scripts\start-db.ps1
```

**Stop server:**
```powershell
.\scripts\stop-db.ps1
```

**Connect (e.g. psql):**
```powershell
psql -U postgres -d "Graduation Project" -p 5433
```

Connection string for apps: `postgresql://postgres@localhost:5433/Graduation%20Project`

---

## Schema and migrations

Migrations live in `db/migrations/`. Run in order with:
```bash
node server/run-migrations.js
```

**Full schema (جداول وعلاقات منظمة):** see **[db/SCHEMA.md](SCHEMA.md)** for:
- ترتيب الجداول والعلاقات (قلب الداتا بيس والتيبلز)
- تفاصيل كل جدول وأهم الأعمدة
- ترتيب تشغيل المايجريشن
- PII vs مرجعية والفهارس

**Core tables:** `app_users`, `colleges`, `majors`, `communities`, `events`, `event_registrations`, `student_profiles`, `notifications`, `login_codes`, `app_module_data`.

**Table overview (PII vs reference):**

| Table | Contains |
|-------|----------|
| `app_users` | PII: email, name, password_hash (nullable), role, college_id, community_id |
| `login_codes` | One-time 6-digit codes for email login |
| `student_profiles` | PII: college, major, gpa, picture per user |
| `event_registrations` | PII: user_id, name, email, student_id per event |
| `notifications` | Per-user title/message |
| `app_module_data` | Keyed JSON per module/user; restrict by module_name and auth |
| `colleges`, `majors`, `communities`, `events` | Reference and event metadata |

**Future-ready:**

- **Module data** (`010_module_data.sql`): `app_module_data` stores keyed JSON per module (`module_name`, optional `user_id`, `key`, `value`). Use for user preferences, feature flags, or any future module without new migrations.
