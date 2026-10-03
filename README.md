# Asset Management

Frontend for the asset management app. This repository is hosted on Vercel. Auth0 login, the Neon database, and Resend email are owned by the Render API in a separate repository.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`API_URL` is optional for viewing the sign-in page. Signing in needs it, because the API checks the email and password. When you set it, restart the dev server so the proxy picks it up.

## Auth

Signed-out visits are redirected to `/sign-in`. There is no sign-up, and the browser never goes to Auth0. The sign-in form posts JSON `{ "email", "password" }` to `/api/auth/login` with credentials included, so the session cookie is stored on this site. The password is not put in the query string or in local storage.

`200` returns the signed-in user. `401` is `{ "error": "Invalid email or password." }`, which the form shows. `400` means the body was invalid. `502` means sign-in is unavailable. After success the browser goes to a safe in-app path from `return_to`, or `/`.

This app treats a person as signed in when `GET {API_URL}/auth/me`, with the browser’s `Cookie` header, returns 200:

```json
{
  "user": {
    "id": "…",
    "email": "…",
    "name": "…",
    "picture": null,
    "roles": [{ "id": "…", "name": "…" }],
    "permissions": ["users:manage"]
  }
}
```

`picture` may be null. `roles` is `{ id, name }[]`. `permissions` is a string array. UI that depends on a permission calls `hasPermission` with that string and stays hidden when it is absent. A missing session is `401`. Any non-200 response leaves the person signed out.

Sign-out is a browser `POST /api/auth/logout`. The response is `{ "ok": true }`, and the API’s `Set-Cookie` clears the httpOnly session cookie for this site. The browser then returns to `/sign-in`. Auth0 credentials stay on the API.

## Environment

The app expects one server-only variable:

| Variable | Where it is set | Purpose |
| --- | --- | --- |
| `API_URL` | `.env.local` locally, Vercel project settings in production | Base URL of the Render API |

Auth0 credentials, the Neon connection string, and the Resend API key belong in the API project. They should not be added here.

The browser calls this app at `/api/*`. Next.js forwards that path to `API_URL`. Server components use `apiFetch` in `src/lib/api.ts`, which calls the API directly and is blocked from client bundles.

## Deploy

Connect this GitHub repository to Vercel and set `API_URL` in the project environment. `vercel.json` sets the framework to Next.js so Vercel does not look for a static `public` output directory.
