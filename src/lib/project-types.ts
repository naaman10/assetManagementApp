export type ProjectType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function parseProjectTypeList(data: unknown): ProjectType[] {
  if (!data || typeof data !== "object") {
    throw new Error("The response could not be read.");
  }

  if (!("projectTypes" in data) || data.projectTypes == null) {
    return [];
  }

  if (!Array.isArray(data.projectTypes)) {
    throw new Error("The response could not be read.");
  }

  return data.projectTypes.map(parseProjectType);
}

export function parseProjectTypeBody(data: unknown): ProjectType {
  if (!data || typeof data !== "object" || !("projectType" in data)) {
    throw new Error("The response was missing a project type.");
  }

  return parseProjectType(data.projectType);
}

function parseProjectType(value: unknown): ProjectType {
  const record = objectRecord(value, "project type");

  return {
    id: requiredString(record, "id"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
    description: optionalString(record, "description"),
    sortOrder: requiredInteger(record, "sortOrder"),
    isActive: requiredBoolean(record, "isActive"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
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

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
}

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error("The response could not be read.");
  }

  return value;
}
