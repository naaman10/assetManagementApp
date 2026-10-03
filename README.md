# Asset Management

Frontend for the asset management app. This repository is hosted on Vercel. Auth0 login, the Neon database, and Resend email are owned by the Render API in a separate repository.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`API_URL` is optional for viewing the sign-in page. Signing in needs it, because Auth0 login is handled by the API. When you set it, restart the dev server so the proxy picks it up.

## Auth

Signed-out visits are redirected to `/sign-in`. There is no sign-up. The sign-in link is a full-page navigation to `/api/auth/login`. The API redirects to Auth0, sets an httpOnly state cookie on this host, and handles `GET /auth/callback` through the same `/api/*` proxy. This app has no callback page and does not call Auth0 from the browser.

After success the API sends the browser to `/`. After failure it sends the browser to `/?auth_error=access_denied`, `invalid_state`, or `auth_failed`, which this app forwards to `/sign-in` with the same `auth_error`. The API ignores `return_to`. This app remembers a safe in-app path in `sessionStorage` and visits it once after sign-in.

This app treats a person as signed in when `GET {API_URL}/auth/me`, with the browser’s `Cookie` header, returns 200:

```json
{
  "user": {
    "id": "…",
    "email": "…",
    "name": "…",
    "picture": null,
    "permissions": ["permission:name"]
  }
}
```

`picture` may be null. `permissions` is the Auth0 permission list. UI that depends on a permission calls `hasPermission` with that string and stays hidden when it is absent. A missing session is `401 { "error": "Unauthorized" }`. Any non-200 response leaves the person signed out.

Sign-out is a browser `POST /api/auth/logout`. The proxy forwards it to the API, and the API’s `Set-Cookie` clears the httpOnly session cookie for this site. The JSON body includes `logoutUrl`. The browser then navigates to that URL so Auth0 ends its own session and returns to this site. Clearing the local cookie alone is not enough. Auth0 tokens stay on the API.

## Environment

The app expects one server-only variable:

| Variable | Where it is set | Purpose |
| --- | --- | --- |
| `API_URL` | `.env.local` locally, Vercel project settings in production | Base URL of the Render API |

Auth0 credentials, the Neon connection string, and the Resend API key belong in the API project. They should not be added here.

The browser calls this app at `/api/*`. Next.js forwards that path to `API_URL`. Server components use `apiFetch` in `src/lib/api.ts`, which calls the API directly and is blocked from client bundles.

## Deploy

Connect this GitHub repository to Vercel and set `API_URL` in the project environment. `vercel.json` sets the framework to Next.js so Vercel does not look for a static `public` output directory.
