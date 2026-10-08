export const FREQUENCY_UNITS = ["days", "weeks", "months", "years"] as const;

export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

export type ScheduleMaintenanceType = {
  id: string;
  code: string;
  name: string;
};

export type MaintenanceSchedule = {
  id: string;
  name: string;
  maintenanceTypeId: string;
  maintenanceType: ScheduleMaintenanceType;
  description: string | null;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  autoWorkorder: boolean;
  startDate: string | null;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  estimatedDurationMinutes: number | null;
  estimatedCost: number | null;
  isActive: boolean;
};

export type MaintenanceScheduleList = {
  maintenanceScheduleCount: number;
  maintenanceSchedules: MaintenanceSchedule[];
};

const singularUnits: Record<FrequencyUnit, string> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
};

export function formatFrequency(value: number, unit: FrequencyUnit): string {
  return value === 1 ? `${value} ${singularUnits[unit]}` : `${value} ${unit}`;
}

export function parseMaintenanceScheduleList(data: unknown): MaintenanceScheduleList {
  const record = objectRecord(data, "maintenance schedule list");
  const schedules = parseSchedules(record.maintenanceSchedules);

  return {
    maintenanceScheduleCount: readCount(record.maintenanceScheduleCount, schedules.length),
    maintenanceSchedules: schedules,
  };
}

export function parseMaintenanceScheduleBody(data: unknown): MaintenanceSchedule {
  if (!data || typeof data !== "object" || !("maintenanceSchedule" in data)) {
    throw new Error("The response was missing a maintenance schedule.");
  }

  return parseMaintenanceSchedule(data.maintenanceSchedule);
}

function parseSchedules(value: unknown): MaintenanceSchedule[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseMaintenanceSchedule);
}

function parseMaintenanceSchedule(value: unknown): MaintenanceSchedule {
  const record = objectRecord(value, "maintenance schedule");
  const maintenanceType = parseMaintenanceType(record.maintenanceType);
  const frequencyUnit = record.frequencyUnit;

  if (!isFrequencyUnit(frequencyUnit)) {
    throw new Error("The response could not be read.");
  }

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    maintenanceTypeId: requiredString(record, "maintenanceTypeId"),
    maintenanceType,
    description: optionalString(record, "description"),
    frequencyValue: requiredInteger(record, "frequencyValue"),
    frequencyUnit,
    autoWorkorder: requiredBoolean(record, "autoWorkorder"),
    startDate: optionalString(record, "startDate"),
    lastCompletedDate: optionalString(record, "lastCompletedDate"),
    nextDueDate: optionalString(record, "nextDueDate"),
    estimatedDurationMinutes: optionalInteger(record, "estimatedDurationMinutes"),
    estimatedCost: optionalNumber(record, "estimatedCost"),
    isActive: requiredBoolean(record, "isActive"),
  };
}

function parseMaintenanceType(value: unknown): ScheduleMaintenanceType {
  const record = objectRecord(value, "maintenance type");

  return {
    id: requiredString(record, "id"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
  };
}

function isFrequencyUnit(value: unknown): value is FrequencyUnit {
  return typeof value === "string" && (FREQUENCY_UNITS as readonly string[]).includes(value);
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

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
}

function optionalInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
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

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error("The response could not be read.");
  }

  return value;
}

function readCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
