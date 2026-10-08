export const WORK_ORDER_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_STATUSES = [
  "open",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const priorityLabels: Record<WorkOrderPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const statusLabels: Record<WorkOrderStatus, string> = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type WorkOrderAsset = {
  id: string;
  assetRef: string;
  assetName: string | null;
};

export type WorkOrderClient = {
  id: string;
  name: string;
};

export type WorkOrderSchedule = {
  id: string;
  name: string;
};

export type WorkOrderType = {
  id: string;
  code: string;
  name: string;
};

export type WorkOrderAssignee = {
  id: string;
  email: string;
  name: string | null;
};

export type WorkOrder = {
  id: string;
  assetId: string;
  asset: WorkOrderAsset;
  client: WorkOrderClient;
  scheduleId: string | null;
  schedule: WorkOrderSchedule | null;
  maintenanceTypeId: string;
  maintenanceType: WorkOrderType;
  assignedTo: string | null;
  assignee: WorkOrderAssignee | null;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  dueDate: string | null;
  scheduledDate: string | null;
  completedAt: string | null;
};

export type WorkOrderList = {
  workOrderCount: number;
  workOrders: WorkOrder[];
};

export function workOrderPriorityLabel(priority: WorkOrderPriority): string {
  return priorityLabels[priority];
}

export function workOrderStatusLabel(status: WorkOrderStatus): string {
  return statusLabels[status];
}

export function workOrderAssetLabel(asset: Pick<WorkOrderAsset, "assetName" | "assetRef">): string {
  return asset.assetName ?? asset.assetRef;
}

export function workOrderTypeLabel(type: Pick<WorkOrderType, "code" | "name">): string {
  return `${type.code} · ${type.name}`;
}

export function workOrderAssigneeLabel(
  assignee: Pick<WorkOrderAssignee, "name" | "email"> | null,
): string {
  if (!assignee) {
    return "—";
  }

  return assignee.name ?? assignee.email;
}

export function parseWorkOrderList(data: unknown): WorkOrderList {
  const record = objectRecord(data, "work order list");
  const workOrders = parseWorkOrders(record.workOrders);

  return {
    workOrderCount: readCount(record.workOrderCount, workOrders.length),
    workOrders,
  };
}

export function parseWorkOrderBody(data: unknown): WorkOrder {
  if (!data || typeof data !== "object" || !("workOrder" in data)) {
    throw new Error("The response was missing a work order.");
  }

  return parseWorkOrder(data.workOrder);
}

function parseWorkOrders(value: unknown): WorkOrder[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseWorkOrder);
}

function parseWorkOrder(value: unknown): WorkOrder {
  const record = objectRecord(value, "work order");
  const asset = objectRecord(record.asset, "asset");
  const client = objectRecord(record.client, "client");
  const maintenanceType = objectRecord(record.maintenanceType, "maintenance type");
  const priority = record.priority;
  const status = record.status;

  if (!isPriority(priority) || !isStatus(status)) {
    throw new Error("The response could not be read.");
  }

  return {
    id: requiredString(record, "id"),
    assetId: requiredString(record, "assetId"),
    asset: {
      id: requiredString(asset, "id"),
      assetRef: requiredString(asset, "assetRef"),
      assetName: optionalString(asset, "assetName"),
    },
    client: {
      id: requiredString(client, "id"),
      name: requiredString(client, "name"),
    },
    scheduleId: optionalString(record, "scheduleId"),
    schedule: record.schedule == null ? null : parseSchedule(record.schedule),
    maintenanceTypeId: requiredString(record, "maintenanceTypeId"),
    maintenanceType: {
      id: requiredString(maintenanceType, "id"),
      code: requiredString(maintenanceType, "code"),
      name: requiredString(maintenanceType, "name"),
    },
    assignedTo: optionalString(record, "assignedTo"),
    assignee: record.assignee == null ? null : parseAssignee(record.assignee),
    title: requiredString(record, "title"),
    description: optionalString(record, "description"),
    priority,
    status,
    dueDate: optionalString(record, "dueDate"),
    scheduledDate: optionalString(record, "scheduledDate"),
    completedAt: optionalString(record, "completedAt"),
  };
}

function parseSchedule(value: unknown): WorkOrderSchedule {
  const record = objectRecord(value, "schedule");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
  };
}

function parseAssignee(value: unknown): WorkOrderAssignee {
  const record = objectRecord(value, "assignee");

  return {
    id: requiredString(record, "id"),
    email: requiredString(record, "email"),
    name: optionalString(record, "name"),
  };
}

function isPriority(value: unknown): value is WorkOrderPriority {
  return typeof value === "string" && (WORK_ORDER_PRIORITIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is WorkOrderStatus {
  return typeof value === "string" && (WORK_ORDER_STATUSES as readonly string[]).includes(value);
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

function readCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
