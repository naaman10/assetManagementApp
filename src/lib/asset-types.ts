export const CLASSIFICATIONS = [
  "group",
  "system",
  "element",
  "asset",
  "component",
] as const;

export type ClassificationType = (typeof CLASSIFICATIONS)[number];

export type AssetType = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  classificationType: ClassificationType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const classificationLabels: Record<ClassificationType, string> = {
  group: "Group",
  system: "System",
  element: "Element",
  asset: "Asset",
  component: "Component",
};

export function classificationLabel(value: ClassificationType): string {
  return classificationLabels[value];
}

export function parseAssetTypeList(data: unknown): AssetType[] {
  if (!data || typeof data !== "object") {
    throw new Error("The response could not be read.");
  }

  if (!("assetTypes" in data) || data.assetTypes == null) {
    return [];
  }

  if (!Array.isArray(data.assetTypes)) {
    throw new Error("The response could not be read.");
  }

  return data.assetTypes.map(parseAssetType);
}

export function parseAssetTypeBody(data: unknown): AssetType {
  if (!data || typeof data !== "object" || !("assetType" in data)) {
    throw new Error("The response was missing an asset type.");
  }

  return parseAssetType(data.assetType);
}

function parseAssetType(value: unknown): AssetType {
  const record = objectRecord(value, "asset type");

  return {
    id: requiredString(record, "id"),
    parentId: optionalId(record, "parentId"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
    description: optionalString(record, "description"),
    classificationType: parseClassification(record.classificationType),
    isActive: requiredBoolean(record, "isActive"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function parseClassification(value: unknown): ClassificationType {
  if (
    typeof value === "string" &&
    (CLASSIFICATIONS as readonly string[]).includes(value)
  ) {
    return value as ClassificationType;
  }

  throw new Error("The response could not be read.");
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`The response was missing an ${label}.`);
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

function optionalId(record: Record<string, unknown>, key: string): string | null {
  if (!(key in record) || record[key] == null) {
    return null;
  }

  return requiredString(record, key);
}

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error("The response could not be read.");
  }

  return value;
}
