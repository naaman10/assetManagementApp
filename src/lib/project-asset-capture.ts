import { ApiRequestError, apiRequest, asApiError } from "@/lib/api-client";
import { parseMaintenanceHistoryBody } from "@/lib/maintenance-history";
import {
  parseProjectAssetReviewStatus,
  parseProjectBody,
  type ProjectAssetReviewStatus,
  type ProjectLocationNode,
} from "@/lib/projects";
import { parseProjectTypeBody } from "@/lib/project-types";
import { parseAssetBody } from "@/lib/sites";
import { parseSurveyPhotoList, type SurveyPhoto } from "@/lib/survey-records";

export const CAPTURE_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "reference",
  "referenceList",
  "media",
] as const;

export type CaptureFieldType = (typeof CAPTURE_FIELD_TYPES)[number];

export const CAPTURE_SOURCES = ["asset", "survey_record", "maintenance_history"] as const;

export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const CAPTURE_TAB_ORDER = [
  { source: "asset" as const, label: "Asset" },
  { source: "survey_record" as const, label: "Survey" },
  { source: "maintenance_history" as const, label: "Maintenance" },
];

export const SURVEY_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "requires_review",
  "approved",
] as const;

export const SURVEY_CONDITION_CODES = ["A", "B", "C", "D"] as const;

/** MH create always needs these, even if omitted from project-type config. */
export const MAINTENANCE_CREATE_KEYS = [
  "maintenanceTypeId",
  "performedAt",
  "workDescription",
] as const;

export const READ_ONLY_CAPTURE_KEYS = new Set(["locationId", "referenceNumber"]);

export const LONG_TEXT_KEYS = new Set([
  "workDescription",
  "observations",
  "comments",
  "findings",
  "actionsTaken",
  "notes",
  "description",
  "conditionBefore",
  "conditionAfter",
  "outcome",
]);

export type CaptureProject = {
  id: string;
  title: string;
  projectReference: string;
  projectTypeId: string;
  projectType: { id: string; code: string; name: string };
};

export type CaptureAsset = {
  id: string;
  tag: string;
  assetName: string | null;
  locationId: string;
  assetTypeId: string;
  status: string;
  reviewStatus: ProjectAssetReviewStatus;
};

export type CaptureField = {
  source: CaptureSource;
  key: string;
  label: string;
  type: CaptureFieldType;
  required: boolean;
  sortOrder: number;
  value: unknown;
};

export type ProjectAssetCapture = {
  project: CaptureProject;
  asset: CaptureAsset;
  fields: CaptureField[];
};

export type ProjectAssetCaptureSaveResult = {
  capture: ProjectAssetCapture;
  surveyRecordId: string | null;
  surveyRecordCreated: boolean;
  maintenanceHistoryId: string | null;
};

export type CaptureValues = Record<CaptureSource, Record<string, unknown>>;

export function parseProjectAssetCaptureBody(data: unknown): ProjectAssetCapture {
  const record = objectRecord(data, "capture response");
  return parseCapture(record.capture);
}

export function parseProjectAssetCaptureSaveBody(
  data: unknown,
): ProjectAssetCaptureSaveResult {
  const record = objectRecord(data, "capture save response");

  return {
    capture: parseCapture(record.capture),
    surveyRecordId: optionalString(record, "surveyRecordId"),
    surveyRecordCreated: optionalBoolean(record, "surveyRecordCreated") ?? false,
    maintenanceHistoryId: optionalString(record, "maintenanceHistoryId"),
  };
}

/**
 * Prefer the dedicated capture endpoint. If it is not available (404), compose
 * the form from project + asset + project-type fields so project asset links
 * still open a working capture view.
 */
export async function fetchProjectAssetCapture(
  projectId: string,
  assetId: string,
): Promise<ProjectAssetCapture> {
  try {
    return parseProjectAssetCaptureBody(
      await apiRequest(`/api/projects/${projectId}/assets/${assetId}/capture`),
    );
  } catch (caught) {
    const error = asApiError(caught);

    if (error.status !== 404) {
      throw error;
    }
  }

  const project = parseProjectBody(await apiRequest(`/api/projects/${projectId}`));
  const onProject =
    project.assets.some((asset) => asset.id === assetId) ||
    project.sites.some((site) => siteHasAsset(site.locations, assetId));

  if (!onProject) {
    throw new ApiRequestError(404, "Not found");
  }

  const assetBody = await apiRequest(`/api/assets/${assetId}`);
  const asset = parseAssetBody(assetBody);
  const assetRecord = objectRecord(
    objectRecord(assetBody, "asset response").asset,
    "asset",
  );
  const projectType = parseProjectTypeBody(
    await apiRequest(`/api/project-types/${project.projectTypeId}`),
  );
  const linked = project.assets.find((item) => item.id === assetId);
  const reviewStatus =
    linked?.reviewStatus ??
    findSiteAssetReviewStatus(project.sites.flatMap((site) => site.locations), assetId) ??
    "todo";

  return {
    project: {
      id: project.id,
      title: project.title,
      projectReference: project.projectReference,
      projectTypeId: project.projectTypeId,
      projectType: {
        id: project.projectType.id,
        code: project.projectType.code,
        name: project.projectType.name,
      },
    },
    asset: {
      id: asset.id,
      tag: asset.tag,
      assetName: asset.assetName,
      locationId: asset.location.id,
      assetTypeId: asset.assetType.id,
      status: asset.status,
      reviewStatus,
    },
    fields: projectType.fields.map((field) => ({
      source: field.source,
      key: field.key,
      label: field.label,
      type: coerceFieldType(field.type),
      required: field.required,
      sortOrder: field.sortOrder,
      value:
        field.source === "asset" ? assetRecordValue(assetRecord, field.key) : null,
    })),
  };
}

export async function saveProjectAssetCapture(
  projectId: string,
  assetId: string,
  body: Record<string, Record<string, unknown>>,
): Promise<ProjectAssetCaptureSaveResult> {
  try {
    return parseProjectAssetCaptureSaveBody(
      await apiRequest(`/api/projects/${projectId}/assets/${assetId}/capture`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );
  } catch (caught) {
    const error = asApiError(caught);

    if (error.status !== 404) {
      throw error;
    }
  }

  if (body.asset) {
    const patch = { ...body.asset };
    delete patch.locationId;
    delete patch.referenceNumber;
    await apiRequest(`/api/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  let maintenanceHistoryId: string | null = null;

  if (body.maintenanceHistory) {
    const created = parseMaintenanceHistoryBody(
      await apiRequest(`/api/assets/${assetId}/maintenance-history`, {
        method: "POST",
        body: JSON.stringify(body.maintenanceHistory),
      }),
    );
    maintenanceHistoryId = created.id;
  }

  let surveyRecordId: string | null = null;
  let surveyRecordCreated = false;

  if (body.surveyRecord) {
    const existingId = await findProjectAssetSurveyRecordId(projectId, assetId);

    if (existingId) {
      await apiRequest(`/api/survey-records/${existingId}`, {
        method: "PATCH",
        body: JSON.stringify(body.surveyRecord),
      });
      surveyRecordId = existingId;
    } else {
      const created = objectRecord(
        await apiRequest(`/api/projects/${projectId}/survey-records`, {
          method: "POST",
          body: JSON.stringify({
            ...body.surveyRecord,
            assetId,
          }),
        }),
        "survey create response",
      );
      const record = objectRecord(created.surveyRecord, "survey record");
      surveyRecordId = requiredString(record, "id");
      surveyRecordCreated = true;
    }
  }

  let capture = await fetchProjectAssetCapture(projectId, assetId);

  if (capture.asset.reviewStatus === "todo") {
    try {
      await apiRequest(`/api/projects/${projectId}/assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewStatus: "in_progress" }),
      });
      capture = {
        ...capture,
        asset: { ...capture.asset, reviewStatus: "in_progress" },
      };
    } catch {
      // Keep the saved capture even if the review bump fails.
    }
  }

  return {
    capture,
    surveyRecordId,
    surveyRecordCreated,
    maintenanceHistoryId,
  };
}

export async function findProjectAssetSurveyRecordId(
  projectId: string,
  assetId: string,
): Promise<string | null> {
  try {
    const data = objectRecord(
      await apiRequest(`/api/projects/${projectId}/survey-records`),
      "survey list",
    );
    const records = data.surveyRecords;

    if (!Array.isArray(records)) {
      return null;
    }

    for (const item of records) {
      const record = objectRecord(item, "survey record");

      if (optionalString(record, "assetId") === assetId) {
        return requiredString(record, "id");
      }
    }
  } catch {
    return null;
  }

  return null;
}

function siteHasAsset(locations: ProjectLocationNode[], assetId: string): boolean {
  for (const location of locations) {
    if (location.assets.some((asset) => asset.id === assetId)) {
      return true;
    }

    if (siteHasAsset(location.locations, assetId)) {
      return true;
    }
  }

  return false;
}

function findSiteAssetReviewStatus(
  locations: ProjectLocationNode[],
  assetId: string,
): ProjectAssetReviewStatus | null {
  for (const location of locations) {
    const match = location.assets.find((asset) => asset.id === assetId);

    if (match) {
      return match.reviewStatus;
    }

    const nested = findSiteAssetReviewStatus(location.locations, assetId);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function coerceFieldType(value: string): CaptureFieldType {
  if ((CAPTURE_FIELD_TYPES as readonly string[]).includes(value)) {
    return value as CaptureFieldType;
  }

  return "text";
}

function assetRecordValue(
  record: Record<string, unknown>,
  key: string,
): unknown {
  if (key === "locationId") {
    if (typeof record.locationId === "string") {
      return record.locationId;
    }

    if (record.location && typeof record.location === "object") {
      return optionalString(record.location as Record<string, unknown>, "id");
    }

    return null;
  }

  if (key === "assetTypeId") {
    if (typeof record.assetTypeId === "string") {
      return record.assetTypeId;
    }

    if (record.assetType && typeof record.assetType === "object") {
      return optionalString(record.assetType as Record<string, unknown>, "id");
    }

    return null;
  }

  if (key in record) {
    return record[key];
  }

  return null;
}

export function fieldsForSource(
  fields: CaptureField[],
  source: CaptureSource,
): CaptureField[] {
  return fields
    .filter((field) => field.source === source)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label);
    });
}

export function availableCaptureTabs(fields: CaptureField[]) {
  return CAPTURE_TAB_ORDER.filter(({ source }) =>
    fields.some((field) => field.source === source),
  );
}

/** Ensure MH create keys exist as required fields when the Maintenance tab is shown. */
export function withMaintenanceCreateFields(fields: CaptureField[]): CaptureField[] {
  const hasMaintenance = fields.some((field) => field.source === "maintenance_history");

  if (!hasMaintenance) {
    return fields;
  }

  const existing = new Set(
    fields
      .filter((field) => field.source === "maintenance_history")
      .map((field) => field.key),
  );
  const extras: CaptureField[] = [];
  let sortOrder =
    Math.max(
      0,
      ...fields
        .filter((field) => field.source === "maintenance_history")
        .map((field) => field.sortOrder),
    ) + 1;

  for (const key of MAINTENANCE_CREATE_KEYS) {
    if (existing.has(key)) {
      continue;
    }

    extras.push({
      source: "maintenance_history",
      key,
      label: maintenanceCreateLabel(key),
      type: key === "performedAt" ? "datetime" : key === "maintenanceTypeId" ? "reference" : "text",
      required: true,
      sortOrder: sortOrder++,
      value: null,
    });
  }

  return [
    ...fields.map((field) =>
      field.source === "maintenance_history" &&
      (MAINTENANCE_CREATE_KEYS as readonly string[]).includes(field.key)
        ? { ...field, required: true }
        : field,
    ),
    ...extras,
  ];
}

export function initialCaptureValues(fields: CaptureField[]): CaptureValues {
  const values: CaptureValues = {
    asset: {},
    survey_record: {},
    maintenance_history: {},
  };

  for (const field of fields) {
    if (field.source === "asset" || field.type === "media") {
      values[field.source][field.key] = normalizeIncomingValue(field);
    } else {
      values[field.source][field.key] = emptyValueForType(field.type);
    }
  }

  return values;
}

export function mediaPhotosFromValue(value: unknown): SurveyPhoto[] {
  try {
    return parseSurveyPhotoList(value);
  } catch {
    return [];
  }
}

export function capturePhotosFieldValue(
  fields: CaptureField[],
): SurveyPhoto[] {
  const field = fields.find(
    (item) => item.source === "survey_record" && item.key === "photos",
  );

  return field ? mediaPhotosFromValue(field.value) : [];
}

export function emptySectionValues(fields: CaptureField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    values[field.key] = emptyValueForType(field.type);
  }

  return values;
}

export function isSectionDirty(
  fields: CaptureField[],
  values: Record<string, unknown>,
): boolean {
  return fields.some((field) => {
    if (READ_ONLY_CAPTURE_KEYS.has(field.key) || field.type === "media") {
      return false;
    }

    return !isEmptyValue(values[field.key], field.type);
  });
}

export function sectionHasRequired(fields: CaptureField[]): boolean {
  return fields.some(
    (field) =>
      field.required &&
      field.type !== "media" &&
      !READ_ONLY_CAPTURE_KEYS.has(field.key) &&
      !isMaintenanceCreateGateKey(field.key),
  );
}

/**
 * Include Service/Maintenance on PUT when a configured required field exists
 * (excluding MH create gates) or the user entered any value. MH create gates
 * are only enforced once the section is included.
 */
export function shouldIncludeSection(
  fields: CaptureField[],
  values: Record<string, unknown>,
): boolean {
  if (fields.length === 0) {
    return false;
  }

  return sectionHasRequired(fields) || isSectionDirty(fields, values);
}

function isMaintenanceCreateGateKey(key: string): boolean {
  return (MAINTENANCE_CREATE_KEYS as readonly string[]).includes(key);
}

export function validateCaptureValues(
  fields: CaptureField[],
  values: CaptureValues,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const source of CAPTURE_SOURCES) {
    const sectionFields = fieldsForSource(fields, source).filter(
      (field) => !READ_ONLY_CAPTURE_KEYS.has(field.key),
    );

    if (sectionFields.length === 0) {
      continue;
    }

    if (source !== "asset" && !shouldIncludeSection(sectionFields, values[source])) {
      continue;
    }

    for (const field of sectionFields) {
      if (!field.required || field.type === "media") {
        continue;
      }

      if (isEmptyValue(values[source][field.key], field.type)) {
        errors[fieldErrorKey(source, field.key)] = [`Enter ${field.label.toLowerCase()}.`];
      }
    }
  }

  return errors;
}

export function buildCapturePutBody(
  fields: CaptureField[],
  values: CaptureValues,
): Record<string, Record<string, unknown>> {
  const body: Record<string, Record<string, unknown>> = {};
  const assetFields = fieldsForSource(fields, "asset").filter(
    (field) => !READ_ONLY_CAPTURE_KEYS.has(field.key),
  );
  const surveyFields = fieldsForSource(fields, "survey_record").filter(
    (field) => !READ_ONLY_CAPTURE_KEYS.has(field.key),
  );
  const maintenanceFields = fieldsForSource(fields, "maintenance_history").filter(
    (field) => !READ_ONLY_CAPTURE_KEYS.has(field.key),
  );

  if (assetFields.length > 0) {
    body.asset = serializeSection(assetFields, values.asset);
  }

  if (shouldIncludeSection(surveyFields, values.survey_record)) {
    body.surveyRecord = serializeSection(surveyFields, values.survey_record);
  }

  if (shouldIncludeSection(maintenanceFields, values.maintenance_history)) {
    body.maintenanceHistory = serializeSection(
      maintenanceFields,
      values.maintenance_history,
    );
  }

  return body;
}

export function fieldErrorKey(source: CaptureSource, key: string): string {
  return `${source}.${key}`;
}

export function mapApiFieldPaths(paths: string[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const path of paths) {
    const normalized = normalizeApiFieldPath(path);

    if (!normalized) {
      continue;
    }

    errors[normalized] = ["This field is invalid."];
  }

  return errors;
}

export function surveyStatusLabel(status: string): string {
  const labels: Record<(typeof SURVEY_STATUSES)[number], string> = {
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
    requires_review: "Requires review",
    approved: "Approved",
  };

  return labels[status as (typeof SURVEY_STATUSES)[number]] ?? status;
}

export function datetimeLocalValue(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 16);
    }

    return "";
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function timestampValue(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function serializeSection(
  fields: CaptureField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.type === "media") {
      continue;
    }

    payload[field.key] = serializeValue(values[field.key], field.type);
  }

  return payload;
}

function serializeValue(value: unknown, type: CaptureFieldType): unknown {
  switch (type) {
    case "media":
      return undefined;
    case "text":
    case "select":
    case "reference": {
      if (typeof value !== "string") {
        return value == null ? null : String(value);
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }

      return null;
    }
    case "boolean":
      return Boolean(value);
    case "date": {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case "datetime": {
      if (typeof value !== "string") {
        return null;
      }

      return timestampValue(value);
    }
    case "referenceList":
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [];
    default:
      return value ?? null;
  }
}

function normalizeIncomingValue(field: CaptureField): unknown {
  if (field.type === "media") {
    return mediaPhotosFromValue(field.value);
  }

  if (field.value == null) {
    return emptyValueForType(field.type);
  }

  if (field.type === "datetime") {
    return datetimeLocalValue(field.value);
  }

  if (field.type === "boolean") {
    return Boolean(field.value);
  }

  if (field.type === "referenceList") {
    return Array.isArray(field.value)
      ? field.value.filter((item): item is string => typeof item === "string")
      : [];
  }

  if (field.type === "number") {
    return field.value == null ? "" : String(field.value);
  }

  if (typeof field.value === "string" || typeof field.value === "number") {
    return String(field.value);
  }

  return emptyValueForType(field.type);
}

function emptyValueForType(type: CaptureFieldType): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "referenceList":
    case "media":
      return [];
    case "number":
    case "text":
    case "date":
    case "datetime":
    case "select":
    case "reference":
      return "";
    default:
      return "";
  }
}

function isEmptyValue(value: unknown, type: CaptureFieldType): boolean {
  if (type === "boolean") {
    return false;
  }

  if (type === "media") {
    return !Array.isArray(value) || value.length === 0;
  }

  if (type === "referenceList") {
    return !Array.isArray(value) || value.length === 0;
  }

  if (type === "number") {
    if (typeof value === "number") {
      return !Number.isFinite(value);
    }

    return typeof value !== "string" || value.trim().length === 0;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return value == null;
}

function normalizeApiFieldPath(path: string): string | null {
  const trimmed = path.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("asset.")) {
    return `asset.${trimmed.slice("asset.".length)}`;
  }

  if (trimmed.startsWith("surveyRecord.")) {
    return `survey_record.${trimmed.slice("surveyRecord.".length)}`;
  }

  if (trimmed.startsWith("survey_record.")) {
    return trimmed;
  }

  if (trimmed.startsWith("maintenanceHistory.")) {
    return `maintenance_history.${trimmed.slice("maintenanceHistory.".length)}`;
  }

  if (trimmed.startsWith("maintenance_history.")) {
    return trimmed;
  }

  return trimmed;
}

function maintenanceCreateLabel(key: (typeof MAINTENANCE_CREATE_KEYS)[number]): string {
  switch (key) {
    case "maintenanceTypeId":
      return "Maintenance type";
    case "performedAt":
      return "Performed at";
    case "workDescription":
      return "Work description";
  }
}

function parseCapture(value: unknown): ProjectAssetCapture {
  const record = objectRecord(value, "capture");
  const project = objectRecord(record.project, "project");
  const projectType = objectRecord(project.projectType, "project type");
  const asset = objectRecord(record.asset, "asset");

  return {
    project: {
      id: requiredString(project, "id"),
      title: requiredString(project, "title"),
      projectReference: requiredString(project, "projectReference"),
      projectTypeId: requiredString(project, "projectTypeId"),
      projectType: {
        id: requiredString(projectType, "id"),
        code: requiredString(projectType, "code"),
        name: requiredString(projectType, "name"),
      },
    },
    asset: {
      id: requiredString(asset, "id"),
      tag: requiredString(asset, "tag"),
      assetName: optionalString(asset, "assetName"),
      locationId: requiredString(asset, "locationId"),
      assetTypeId: requiredString(asset, "assetTypeId"),
      status: requiredString(asset, "status"),
      reviewStatus: parseProjectAssetReviewStatus(asset.reviewStatus),
    },
    fields: parseFields(record.fields),
  };
}

function parseFields(value: unknown): CaptureField[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item, index) => {
    const record = objectRecord(item, "capture field");
    const source = requiredSource(record, "source");
    const key = requiredString(record, "key");

    return {
      source,
      key,
      label: optionalString(record, "label") ?? key,
      type: requiredFieldType(record, "type"),
      required: optionalBoolean(record, "required") ?? false,
      sortOrder:
        typeof record.sortOrder === "number" && Number.isInteger(record.sortOrder)
          ? record.sortOrder
          : index,
      value: "value" in record ? record.value : null,
    };
  });
}

function requiredSource(
  record: Record<string, unknown>,
  key: string,
): CaptureSource {
  const value = record[key];

  if (
    typeof value === "string" &&
    (CAPTURE_SOURCES as readonly string[]).includes(value)
  ) {
    return value as CaptureSource;
  }

  throw new Error("The response could not be read.");
}

function requiredFieldType(
  record: Record<string, unknown>,
  key: string,
): CaptureFieldType {
  const value = record[key];

  if (
    typeof value === "string" &&
    (CAPTURE_FIELD_TYPES as readonly string[]).includes(value)
  ) {
    return value as CaptureFieldType;
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

function optionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}
