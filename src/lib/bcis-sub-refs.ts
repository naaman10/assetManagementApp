export type BcisSubRef = {
  id: string;
  bcisRefId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function parseBcisSubRefList(data: unknown): BcisSubRef[] {
  if (!data || typeof data !== "object") {
    throw new Error("The response could not be read.");
  }

  if (!("bcisSubRefs" in data) || data.bcisSubRefs == null) {
    return [];
  }

  if (!Array.isArray(data.bcisSubRefs)) {
    throw new Error("The response could not be read.");
  }

  return data.bcisSubRefs.map(parseBcisSubRef);
}

export function parseBcisSubRefBody(data: unknown): BcisSubRef {
  if (!data || typeof data !== "object" || !("bcisSubRef" in data)) {
    throw new Error("The response was missing a BCIS sub reference.");
  }

  return parseBcisSubRef(data.bcisSubRef);
}

function parseBcisSubRef(value: unknown): BcisSubRef {
  const record = objectRecord(value, "BCIS sub reference");

  return {
    id: requiredString(record, "id"),
    bcisRefId: requiredString(record, "bcisRefId"),
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
