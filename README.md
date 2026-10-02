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

Signed-out visits are redirected to `/sign-in`. The Google button sends the browser to `/api/auth/google`, which this app forwards to the API.

The API owns the OAuth callback and the session cookie. This app treats a person as signed in when `GET {API_URL}/auth/session` returns:

```json
{ "user": { "id": "…", "email": "…", "name": "…" } }
```

The request includes the cookies the browser sent to this app. Any other response leaves the person on the sign-in page.

## Environment

The app expects one server-only variable:

| Variable | Where it is set | Purpose |
| --- | --- | --- |
| `API_URL` | `.env.local` locally, Vercel project settings in production | Base URL of the Render API |

Google OAuth credentials, the Neon connection string, and the Resend API key belong in the API project. They should not be added here.

The browser calls this app at `/api/*`. Next.js forwards that path to `API_URL`. Server components use `apiFetch` in `src/lib/api.ts`, which calls the API directly and is blocked from client bundles.

## Deploy

Connect this GitHub repository to Vercel and set `API_URL` in the project environment. `vercel.json` sets the framework to Next.js so Vercel does not look for a static `public` output directory.
