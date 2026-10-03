export type SessionRole = {
  id: string;
  name: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  roles: SessionRole[];
  permissions: string[];
};

export type Session = {
  user: SessionUser;
};

export { safeReturnPath } from "@/lib/return-path";

function apiOrigin(): string | undefined {
  const url = process.env.API_URL?.trim().replace(/\/$/, "");
  return url || undefined;
}

/**
 * Asks the Render API whether the incoming cookies belong to a signed-in user.
 * `GET {API_URL}/auth/me` returns 200 `{ user: { id, email, name, picture, roles, permissions } }` when they do.
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
  const picture = "picture" in user ? user.picture : null;
  const roles = "roles" in user ? user.roles : [];
  const permissions = "permissions" in user ? user.permissions : [];

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof email !== "string" ||
    email.length === 0
  ) {
    return null;
  }

  return {
    user: {
      id,
      email,
      name: typeof name === "string" ? name : null,
      picture: typeof picture === "string" ? picture : null,
      roles: parseRoles(roles),
      permissions: parsePermissions(permissions),
    },
  };
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

function parseRoles(value: unknown): SessionRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const id = "id" in item ? item.id : undefined;
    const name = "name" in item ? item.name : undefined;

    if (
      typeof id !== "string" ||
      id.length === 0 ||
      typeof name !== "string" ||
      name.length === 0
    ) {
      return [];
    }

    return [{ id, name }];
  });
}

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
