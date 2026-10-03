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

export const USERS_VIEW = "users:view";
export const USERS_CREATE = "users:create";
export const USERS_EDIT = "users:edit";
export const USERS_DELETE = "users:delete";
export const ROLES_VIEW = "roles:view";
export const ROLES_CREATE = "roles:create";
export const ROLES_EDIT = "roles:edit";
export const ROLES_DELETE = "roles:delete";
export const PERMISSIONS_VIEW = "permissions:view";
export const ADMIN_ROLE = "admin";

export const USER_AREA_PERMISSIONS = [
  USERS_VIEW,
  USERS_CREATE,
  USERS_EDIT,
  USERS_DELETE,
] as const;

export const ROLE_AREA_PERMISSIONS = [
  ROLES_VIEW,
  ROLES_CREATE,
  ROLES_EDIT,
  ROLES_DELETE,
] as const;

export function hasPermission(
  user: SessionUser,
  permission: string,
): boolean {
  return user.permissions.includes(permission);
}

export function hasAnyPermission(
  user: SessionUser,
  permissions: readonly string[],
): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}

export function parseSession(data: unknown): Session | null {
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
