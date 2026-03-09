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
   This starts the backend (default port 2000) and the frontend dev server (Vite). Open the URL shown in the terminal (e.g. http://localhost:5173).

## Scripts

- `npm run dev:all` — run backend and frontend together
- `npm run dev` — frontend only (Vite)
- `npm run server` — backend only
- `npm run migrate` — run database migrations

## Authors

Sameer Masri, Sami Tuffaha
