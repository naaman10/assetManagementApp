export type HistoryMaintenanceType = {
  id: string;
  code: string;
  name: string;
};

export type HistoryPerformer = {
  id: string;
  email: string;
  name: string | null;
};

export type HistoryWorkOrder = {
  id: string;
  reference: string;
  title: string;
};

export type MaintenanceHistoryPhoto = {
  id: string;
  url: string;
  contentType: string;
  createdAt: string;
  caption: string | null;
};

export type MaintenanceHistory = {
  id: string;
  assetId: string;
  workOrderId: string | null;
  workOrder: HistoryWorkOrder | null;
  maintenanceTypeId: string;
  maintenanceType: HistoryMaintenanceType;
  performedBy: string | null;
  performer: HistoryPerformer | null;
  referenceNumber: string;
  performedAt: string;
  completedAt: string | null;
  workDescription: string;
  findings: string | null;
  actionsTaken: string | null;
  conditionBefore: string | null;
  conditionAfter: string | null;
  outcome: string | null;
  labourCost: number | null;
  materialsCost: number | null;
  otherCost: number | null;
  nextRecommendedDate: string | null;
  notes: string | null;
  photos: MaintenanceHistoryPhoto[];
};

export const MAX_HISTORY_PHOTOS = 20;
export const MAX_HISTORY_PHOTO_BYTES = 10 * 1024 * 1024;
export const HISTORY_PHOTO_LIMIT_MESSAGE =
  "A maintenance history record can have at most 20 photos.";

export type MaintenanceHistoryList = {
  maintenanceHistoryCount: number;
  maintenanceHistories: MaintenanceHistory[];
};

export function parseMaintenanceHistoryList(data: unknown): MaintenanceHistoryList {
  const record = objectRecord(data, "maintenance history list");
  const records = parseHistories(record.maintenanceHistories);

  return {
    maintenanceHistoryCount: readCount(record.maintenanceHistoryCount, records.length),
    maintenanceHistories: records,
  };
}

export function parseMaintenanceHistoryBody(data: unknown): MaintenanceHistory {
  if (!data || typeof data !== "object" || !("maintenanceHistory" in data)) {
    throw new Error("The response was missing a maintenance history.");
  }

  return parseMaintenanceHistory(data.maintenanceHistory);
}

function parseHistories(value: unknown): MaintenanceHistory[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseMaintenanceHistory);
}

function parseMaintenanceHistory(value: unknown): MaintenanceHistory {
  const record = objectRecord(value, "maintenance history");

  return {
    id: requiredString(record, "id"),
    assetId: requiredString(record, "assetId"),
    workOrderId: optionalString(record, "workOrderId"),
    workOrder: record.workOrder == null ? null : parseWorkOrder(record.workOrder),
    maintenanceTypeId: requiredString(record, "maintenanceTypeId"),
    maintenanceType: parseMaintenanceType(record.maintenanceType),
    performedBy: optionalString(record, "performedBy"),
    performer: record.performer == null ? null : parsePerformer(record.performer),
    referenceNumber: requiredString(record, "referenceNumber"),
    performedAt: requiredString(record, "performedAt"),
    completedAt: optionalString(record, "completedAt"),
    workDescription: requiredString(record, "workDescription"),
    findings: optionalString(record, "findings"),
    actionsTaken: optionalString(record, "actionsTaken"),
    conditionBefore: optionalString(record, "conditionBefore"),
    conditionAfter: optionalString(record, "conditionAfter"),
    outcome: optionalString(record, "outcome"),
    labourCost: optionalNumber(record, "labourCost"),
    materialsCost: optionalNumber(record, "materialsCost"),
    otherCost: optionalNumber(record, "otherCost"),
    nextRecommendedDate: optionalString(record, "nextRecommendedDate"),
    notes: optionalString(record, "notes"),
    photos: parsePhotos(record.photos),
  };
}

function parsePhotos(value: unknown): MaintenanceHistoryPhoto[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parsePhoto);
}

function parsePhoto(value: unknown): MaintenanceHistoryPhoto {
  const record = objectRecord(value, "photo");

  return {
    id: requiredString(record, "id"),
    url: requiredString(record, "url"),
    contentType: requiredString(record, "contentType"),
    createdAt: requiredString(record, "createdAt"),
    caption: optionalString(record, "caption"),
  };
}

export function safePhotoUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function photoFileProblem(bytes: Uint8Array, size: number): string | null {
  if (!isPhotoImage(bytes)) {
    return "Photo must be a JPEG, PNG, or WebP image.";
  }

  if (size > MAX_HISTORY_PHOTO_BYTES) {
    return "Photo must be 10 MB or smaller.";
  }

  return null;
}

function isPhotoImage(bytes: Uint8Array): boolean {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return true;
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function parseMaintenanceType(value: unknown): HistoryMaintenanceType {
  const record = objectRecord(value, "maintenance type");

  return {
    id: requiredString(record, "id"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
  };
}

function parseWorkOrder(value: unknown): HistoryWorkOrder {
  const record = objectRecord(value, "work order");

  return {
    id: requiredString(record, "id"),
    reference: requiredString(record, "reference"),
    title: requiredString(record, "title"),
  };
}

function parsePerformer(value: unknown): HistoryPerformer {
  const record = objectRecord(value, "performer");

  return {
    id: requiredString(record, "id"),
    email: requiredString(record, "email"),
    name: optionalString(record, "name"),
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

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }

  throw new Error("The response could not be read.");
}

function readCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
