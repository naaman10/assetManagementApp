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
};

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
  };
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
