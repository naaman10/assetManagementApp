export type BcisRef = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function formatBcisRef(ref: Pick<BcisRef, "code" | "name">): string {
  return `${ref.code} · ${ref.name}`;
}

export function parseBcisRefList(data: unknown): BcisRef[] {
  if (!data || typeof data !== "object") {
    throw new Error("The response could not be read.");
  }

  if (!("bcisRefs" in data) || data.bcisRefs == null) {
    return [];
  }

  if (!Array.isArray(data.bcisRefs)) {
    throw new Error("The response could not be read.");
  }

  return data.bcisRefs.map(parseBcisRef);
}

export function parseBcisRefBody(data: unknown): BcisRef {
  if (!data || typeof data !== "object" || !("bcisRef" in data)) {
    throw new Error("The response was missing a BCIS reference.");
  }

  return parseBcisRef(data.bcisRef);
}

function parseBcisRef(value: unknown): BcisRef {
  const record = objectRecord(value, "BCIS reference");

  return {
    id: requiredString(record, "id"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
    description: optionalString(record, "description"),
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

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error("The response could not be read.");
  }

  return value;
}
