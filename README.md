# Asset Management

Frontend for the asset management app. This repository is hosted on Vercel. Google sign-in, the Neon database, and Resend email are owned by the Render API in a separate repository.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`API_URL` is optional for viewing the sign-in page. Signing in needs it, because Google OAuth is handled by the API. When you set it, restart the dev server so the proxy picks it up.

## Auth

Signed-out visits are redirected to `/sign-in`. The Google link is a full-page navigation to `/api/auth/google`. The API redirects to Google, sets an httpOnly `oauth_state` cookie on this host, and handles `GET /auth/google/callback` through the same proxy. This app has no callback page.

After success the API sends the browser to `/`. After failure it sends the browser to `/?auth_error=access_denied`, `invalid_state`, or `auth_failed`, which this app forwards to `/sign-in` with the same `auth_error`. The API ignores `return_to`. This app remembers a safe in-app path in `sessionStorage` and visits it once after sign-in.

This app treats a person as signed in when `GET {API_URL}/auth/me`, with the browser’s `Cookie` header, returns 200:

```json
{ "user": { "id": "…", "email": "…", "name": "…", "picture": null } }
```

A missing session is `401 { "error": "Unauthorized" }`. Any non-200 response leaves the person signed out.

Sign-out is a browser `POST /api/auth/logout`. The proxy forwards it to the API, and the API’s `Set-Cookie` clears the httpOnly session cookie for this site. A server-side fetch of the Render host would not clear that cookie. The browser then goes to `/sign-in`.

## Environment

The app expects one server-only variable:

| Variable | Where it is set | Purpose |
| --- | --- | --- |
| `API_URL` | `.env.local` locally, Vercel project settings in production | Base URL of the Render API |

Google OAuth credentials, the Neon connection string, and the Resend API key belong in the API project. They should not be added here.

The browser calls this app at `/api/*`. Next.js forwards that path to `API_URL`. Server components use `apiFetch` in `src/lib/api.ts`, which calls the API directly and is blocked from client bundles.

## Deploy

Connect this GitHub repository to Vercel and set `API_URL` in the project environment. `vercel.json` sets the framework to Next.js so Vercel does not look for a static `public` output directory.
