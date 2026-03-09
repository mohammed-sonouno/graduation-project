# graduation-project
Smart platform for majors, events, and AI academic guidance at An-Najah University.  
sameer masri · sami Tuffaha

## Ports (in repo)

- **Frontend:** port **3000** (Vite dev server; see `vite.config.js`)
- **Backend:** port **2000** (Express; override with `PORT` in `.env`)
- Frontend proxies `/api` → `http://localhost:2000`

These values are in the code and in `.env.example` so they are pushed with the project.

## Run the full project

1. `npm install`
2. Copy `.env.example` to `.env` and set any overrides (e.g. `DATABASE_URL`, `JWT_SECRET`). Ports work with defaults.
3. **Backend:** `npm run server` (or `npm run server:dev` with nodemon)
4. **Frontend:** `npm run dev` (Vite on port 3000)
5. Or both: `npm run dev:all`

Migrations: `npm run migrate`
