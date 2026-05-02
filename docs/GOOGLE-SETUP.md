# Continue with Google — Setup Guide

Follow these steps to enable "Continue with Google" on the login page.

## 1. Create a Google Cloud project (if you don’t have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top → **New Project**.
3. Enter a name (e.g. "Graduation Project") and click **Create**.

## 2. Configure the OAuth consent screen

1. In the left menu go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (or Internal if it’s a Google Workspace app) → **Create**.
3. Fill in:
   - **App name**: e.g. "Najah Graduation Project"
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**.
5. On **Scopes**: click **Add or Remove Scopes**, add **email**, **profile**, **openid** (or leave defaults), then **Save and Continue**.
6. On **Test users** (if External): add your test Google accounts if the app is in "Testing", then **Save and Continue**.

## 3. Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. **Application type**: **Web application**.
4. **Name**: e.g. "Graduation Project Web".
5. Under **Authorized JavaScript origins**, click **+ ADD URI** and add **exactly** the URL you use to open the app in the browser. This project uses **port 3000** by default:
   - `http://localhost:3000`  
   (No path, no trailing slash. If you use another port, add that instead.)
6. (Optional) Under **Authorized redirect URIs**: you can leave empty for the implicit flow used by this app.
7. Click **Create**.
8. Copy the **Client ID** (looks like `123456789012-xxxx.apps.googleusercontent.com`).

## 4. Put the Client ID in your project

1. Open the `.env` file in the project root (create it from `.env.example` if needed).
2. Set:
   ```env
   VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   ```
   Replace `YOUR_CLIENT_ID_HERE` with the Client ID you copied (no quotes).
3. Save the file.

## 5. Restart the dev server

Restart so Vite picks up the new env variable:

- Stop the current process (Ctrl+C).
- Run again: `npm start`.

Then open the app at **http://localhost:3000**, go to the login page, and click **Sign in with Google**.

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| **"The OAuth client was not found" / Error 401: invalid_client** | The Client ID in `.env` is wrong or still the placeholder. Create a real OAuth client in Google Cloud (step 3) and paste the Client ID into `VITE_GOOGLE_CLIENT_ID`. |
| **"redirect_uri_mismatch" or "Access blocked"** | The URL in the browser (e.g. `http://localhost:3000`) must be listed exactly in **Authorized JavaScript origins** in the OAuth client. Use no path and no trailing slash. Add that URI and save. |
| **Button doesn’t appear** | Ensure `.env` has `VITE_GOOGLE_CLIENT_ID` set to a real Client ID (not `your-google-client-id...` or `placeholder`). Restart the dev server after changing `.env`. |
| **"Please use a Najah University Google account"** | Only `@stu.najah.edu` and `@najah.edu` are allowed. Sign in with one of those Google accounts. |

## Summary

- **Client ID** from Google Cloud → into `.env` as `VITE_GOOGLE_CLIENT_ID`.
- **Authorized JavaScript origins** = the exact URL you use (e.g. `http://localhost:3000` for this project).
- Restart dev server after changing `.env`.
