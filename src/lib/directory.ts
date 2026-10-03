export type RoleRef = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  disabled: boolean;
  roles: RoleRef[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

export type Permission = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type RolePermission = {
  id: string;
  name: string;
  description: string | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
};

export function parseUserList(data: unknown): User[] {
  return readArray(data, "users").map(parseUser);
}

export function parseUserBody(data: unknown): User {
  if (!data || typeof data !== "object" || !("user" in data)) {
    throw new Error("The response was missing a user.");
  }

  return parseUser(data.user);
}

export function parseRoleList(data: unknown): Role[] {
  return readArray(data, "roles").map(parseRole);
}

export function parseRoleBody(data: unknown): Role {
  if (!data || typeof data !== "object" || !("role" in data)) {
    throw new Error("The response was missing a role.");
  }

  return parseRole(data.role);
}

export function parsePermissionList(data: unknown): Permission[] {
  return readArray(data, "permissions").map(parsePermission);
}

export function sameIds(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const ids = new Set(left);
  return right.every((id) => ids.has(id));
}

function parseUser(value: unknown): User {
  const record = objectRecord(value, "user");
  const id = requiredString(record, "id");
  const email = requiredString(record, "email");

  return {
    id,
    email,
    name: optionalString(record, "name"),
    picture: optionalString(record, "picture"),
    disabled: record.disabled === true,
    roles: Array.isArray(record.roles) ? record.roles.flatMap(parseRoleRef) : [],
    permissions: stringList(record.permissions),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function parseRole(value: unknown): Role {
  const record = objectRecord(value, "role");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    description: optionalString(record, "description"),
    permissions: Array.isArray(record.permissions)
      ? record.permissions.flatMap(parseRolePermission)
      : [],
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function parsePermission(value: unknown): Permission {
  const record = objectRecord(value, "permission");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    description: optionalString(record, "description"),
    createdAt: optionalString(record, "createdAt") ?? "",
  };
}

function parseRoleRef(value: unknown): RoleRef[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const id = "id" in value ? value.id : undefined;
  const name = "name" in value ? value.name : undefined;

  if (typeof id !== "string" || typeof name !== "string" || id.length === 0) {
    return [];
  }

  return [{ id, name }];
}

function parseRolePermission(value: unknown): RolePermission[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const id = "id" in value ? value.id : undefined;
  const name = "name" in value ? value.name : undefined;
  const description = "description" in value ? value.description : null;

  if (typeof id !== "string" || typeof name !== "string" || id.length === 0) {
    return [];
  }

  return [
    {
      id,
      name,
      description: typeof description === "string" ? description : null,
    },
  ];
}

function readArray(data: unknown, key: string): unknown[] {
  if (!data || typeof data !== "object" || !(key in data)) {
    throw new Error("The response could not be read.");
  }

  const value = data[key as keyof typeof data];

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`The response was missing a ${label}.`);
  }

  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error("The response could not be read.");
  }

  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
