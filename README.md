# Graduation Project

Smart platform for majors, events, and AI academic guidance at An-Najah University.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Copy the example environment file**
   ```bash
   cp .env.example .env
   ```
   On Windows (PowerShell):
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Fill in environment values**  
   Edit `.env` and replace placeholders with your real values (database URL, optional Google OAuth client ID, optional SMTP for login emails). See `.env.example` for variable descriptions. Do not commit `.env`.

4. **Run the app**
   ```bash
   npm run dev:all
   ```
   This starts the backend (port 2000), the frontend (Vite on port 3000), and the NLP service. Open **http://localhost:3000**.

   For frontend + backend only (no NLP): `npm run dev:web`.

## Scripts

- `npm run dev:all` — run backend, frontend, and NLP together
- `npm run dev:web` — run backend and frontend only (ports 2000 and 3000)
- `npm run dev` — frontend only (Vite)
- `npm run server` — backend only
- `npm run migrate` — run database migrations
- `npm run seed:ieee` — seed IEEE association, admin (admin@najah.edu), IEEE leader (ieee@najah.edu), IEEE supervisor (ieee.sup@najah.edu), Engineering dean (eng.dean@najah.edu); all passwords `123`. Run after `migrate`.

## Authors

Sameer Masri, Sami Tuffaha
