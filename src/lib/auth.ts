export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export type Session = {
  user: SessionUser;
};

function apiOrigin(): string | undefined {
  const url = process.env.API_URL?.trim().replace(/\/$/, "");
  return url || undefined;
}

/**
 * Asks the Render API whether the incoming cookies belong to a signed-in user.
 * `GET {API_URL}/auth/session` returns `{ user: { id, email, name } }` when they do.
 */
export async function getSession(
  cookieHeader: string | null,
): Promise<Session | null> {
  const origin = apiOrigin();

  if (!origin) {
    return null;
  }

  try {
    const response = await fetch(`${origin}/auth/session`, {
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

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }

  let path = value;

  try {
    path = decodeURIComponent(value);
  } catch {
    return "/";
  }

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.startsWith("/sign-in")
  ) {
    return "/";
  }

  return path;
}

export function googleSignInPath(returnTo: string): string {
  const params = new URLSearchParams();

  if (returnTo !== "/") {
    params.set("return_to", returnTo);
  }

  const query = params.toString();
  return query ? `/api/auth/google?${query}` : "/api/auth/google";
}

function parseSession(data: unknown): Session | null {
  if (!data || typeof data !== "object" || !("user" in data)) {
    return null;
  }

  const user = data.user;

  if (!user || typeof user !== "object") {
    return null;
  }

  const id = "id" in user ? user.id : undefined;
  const email = "email" in user ? user.email : undefined;
  const name = "name" in user ? user.name : null;

  if (
    (typeof id !== "string" && typeof id !== "number") ||
    typeof email !== "string" ||
    email.length === 0
  ) {
    return null;
  }

  return {
    user: {
      id: String(id),
      email,
      name: typeof name === "string" ? name : null,
    },
  };
}
