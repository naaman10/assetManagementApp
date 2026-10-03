import { parseSession, type Session } from "@/lib/session";

export type { Session, SessionRole, SessionUser } from "@/lib/session";
export { hasAnyPermission, hasPermission } from "@/lib/session";
export { safeReturnPath } from "@/lib/return-path";

function apiOrigin(): string | undefined {
  const url = process.env.API_URL?.trim().replace(/\/$/, "");
  return url || undefined;
}

/**
 * Asks the Render API whether the incoming cookies belong to a signed-in user.
 * `GET {API_URL}/auth/me` returns 200 `{ user }` when they do.
 * Any other response, including 401, means signed out.
 */
export async function getSession(
  cookieHeader: string | null,
): Promise<Session | null> {
  const origin = apiOrigin();

  if (!origin) {
    return null;
  }

  try {
    const response = await fetch(`${origin}/auth/me`, {
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return parseSession(data);
  } catch {
    return null;
  }
}
