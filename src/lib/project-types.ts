export const PROJECT_TYPE_FIELD_SOURCES = [
  "asset",
  "maintenance_history",
  "survey_record",
] as const;

export type ProjectTypeFieldSource = (typeof PROJECT_TYPE_FIELD_SOURCES)[number];

export type ProjectTypeFieldRef = {
  source: ProjectTypeFieldSource;
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
};

export type ProjectTypeFieldCatalogItem = {
  source: ProjectTypeFieldSource;
  key: string;
  label: string;
  type: string;
  description: string | null;
};

export type ProjectTypeFieldCatalog = {
  fields: ProjectTypeFieldCatalogItem[];
};

export type ProjectType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  fields: ProjectTypeFieldRef[];
  createdAt: string;
  updatedAt: string;
};

const sourceLabels: Record<ProjectTypeFieldSource, string> = {
  asset: "Asset",
  maintenance_history: "Maintenance History",
  survey_record: "Service Record",
};

export function projectTypeFieldSourceLabel(source: ProjectTypeFieldSource): string {
  return sourceLabels[source];
}

export function fieldRefId(field: Pick<ProjectTypeFieldRef, "source" | "key">): string {
  return `${field.source}:${field.key}`;
}

export function projectTypeFieldSourceOrder(source: ProjectTypeFieldSource): number {
  return PROJECT_TYPE_FIELD_SOURCES.indexOf(source);
}

/**
 * Pack fields into source groups (Asset → Maintenance History → Service Record),
 * keeping each group's relative order as given, then renumber sortOrder.
 */
export function normalizeProjectTypeFields(
  fields: ProjectTypeFieldRef[],
): ProjectTypeFieldRef[] {
  return PROJECT_TYPE_FIELD_SOURCES.flatMap((source) =>
    fields.filter((field) => field.source === source),
  ).map((field, index) => ({
    ...field,
    sortOrder: index,
  }));
}

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

export function parseProjectTypeFieldCatalog(data: unknown): ProjectTypeFieldCatalog {
  const record = objectRecord(data, "project type field catalog");
  const fields = withSurveyPhotosCatalogField(parseCatalogFields(record.fields));

  return { fields };
}

/** Ensure Photos (media) is available even if the catalog API omits it. */
function withSurveyPhotosCatalogField(
  fields: ProjectTypeFieldCatalogItem[],
): ProjectTypeFieldCatalogItem[] {
  if (
    fields.some(
      (field) => field.source === "survey_record" && field.key === "photos",
    )
  ) {
    return fields;
  }

  return [
    ...fields,
    {
      source: "survey_record",
      key: "photos",
      label: "Photos",
      type: "media",
      description: "Uploaded after the survey is saved on the asset capture form.",
    },
  ];
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
    fields: sortFields(parseFields(record.fields)),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function parseFields(value: unknown): ProjectTypeFieldRef[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item, index) => {
    const record = objectRecord(item, "project type field");
    const source = requiredSource(record, "source");
    const key = requiredString(record, "key");

    return {
      source,
      key,
      label: optionalString(record, "label") ?? key,
      type: optionalString(record, "type") ?? key,
      required: optionalBoolean(record, "required") ?? false,
      sortOrder:
        typeof record.sortOrder === "number" && Number.isInteger(record.sortOrder)
          ? record.sortOrder
          : index,
    };
  });
}

function parseCatalogFields(value: unknown): ProjectTypeFieldCatalogItem[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item) => {
    const record = objectRecord(item, "catalog field");

    const key = requiredString(record, "key");

    return {
      source: requiredSource(record, "source"),
      key,
      label: requiredString(record, "label"),
      type: optionalString(record, "type") ?? key,
      description: optionalString(record, "description"),
    };
  });
}

function sortFields(fields: ProjectTypeFieldRef[]): ProjectTypeFieldRef[] {
  return PROJECT_TYPE_FIELD_SOURCES.flatMap((source) =>
    fields
      .filter((field) => field.source === source)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.label.localeCompare(right.label);
      }),
  ).map((field, index) => ({
    ...field,
    sortOrder: index,
  }));
}

function requiredSource(
  record: Record<string, unknown>,
  key: string,
): ProjectTypeFieldSource {
  const value = record[key];

  if (
    typeof value === "string" &&
    (PROJECT_TYPE_FIELD_SOURCES as readonly string[]).includes(value)
  ) {
    return value as ProjectTypeFieldSource;
  }

  throw new Error("The response could not be read.");
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

function optionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}
