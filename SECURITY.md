# Security checklist and recommendations

This document summarizes security measures applied in the project and what to do for production.

## Applied in code

- **Auth**: JWT in httpOnly cookie; no tokens in localStorage. Login codes expire (10 min). Passwords hashed with bcrypt (10 rounds).
- **Secrets**: In production, `JWT_SECRET`, `DATABASE_URL`, and optionally `ADMIN_EMAIL` / `ADMIN_PASSWORD` must be set in `.env`. No hardcoded DB URL or admin password when `NODE_ENV=production`.
- **Headers**: Helmet middleware (CSP disabled by default; enable and tune for your frontend if needed).
- **Rate limiting**: Auth routes (`/api/auth/*`) limited to 50 requests per 15 minutes per IP to reduce brute-force and code abuse.
- **Analytics**: Dashboard analytics routes require authenticated admin; not publicly readable.
- **SQL**: All queries use parameterized statements (`$1`, `$2`, …); no string concatenation for user input.
- **Input**: Email/password length limits; email domain allowlist; password strength rules in `config/rules.js`. Event and profile payloads validated.
- **DB constraints**: Role and status checks in migrations (e.g. `app_users_role_check`, `events_status_check`, `event_reviews` rating 1–5).

## Production checklist

1. **Environment**
   - Set `NODE_ENV=production`.
   - Set `JWT_SECRET` to a long random value (e.g. `openssl rand -hex 32`).
   - Set `DATABASE_URL`; do not rely on any default connection string.
   - Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you use the built-in admin bootstrap.
   - Restrict `CORS_ORIGIN` to your real frontend origin(s).

2. **HTTPS**
   - Serve the app over HTTPS. Set `secure: true` for cookies (already conditional on `NODE_ENV === 'production'` in code).

3. **Database**
   - Run migrations: `npm run migrate`.
   - Use a DB user with minimal required privileges (no superuser for the app).
   - Prefer connection pooling (e.g. PgBouncer) in front of PostgreSQL if needed.

4. **Dependencies**
   - Run `npm audit` and fix high/critical issues. Keep dependencies updated.

5. **Logging**
   - Avoid logging request bodies or tokens. Auth logging in this app is structured and does not log passwords or full tokens.

## Optional improvements

- **CSP**: Enable Helmet’s Content-Security-Policy and tune for your frontend (scripts, styles, origins).
- **Stricter rate limits**: Reduce auth limit or add per-email limits for login-code requests.
- **Audit log**: Persist security-relevant events (login failures, role changes, event approval) to a table for auditing.
- **Session invalidation**: Implement token revocation (e.g. blocklist or short-lived tokens + refresh) if you need to invalidate sessions before expiry.
- **Dependencies**: Run `npm audit` and fix reported vulnerabilities; prefer `npm audit fix` before `npm audit fix --force`.

## Code and database strength

- **Validation**: All event and registration payloads are validated; required fields and types enforced in `config/rules.js` and server handlers.
- **Database**: Migrations add CHECK constraints (roles, statuses, rating 1–5), indexes for frequent queries, and foreign keys with ON DELETE CASCADE where appropriate. Use `npm run migrate` to apply.
- **Errors**: Server returns generic messages to clients (e.g. "Invalid email or password") and logs details server-side to avoid leaking information.
