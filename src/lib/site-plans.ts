export type PlanGeometry = {
  type: "Polygon";
  /** Rings of [x, y] in normalized 0–1 plan space. */
  coordinates: number[][][];
};

export type PlanFeature = {
  id: string;
  locationId: string;
  location: {
    id: string;
    locationCode: string | null;
    name: string | null;
    locationType: string | null;
  };
  geometry: PlanGeometry;
  labelOverride: string | null;
  sortOrder: number;
};

export type SitePlanListItem = {
  id: string;
  name: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  site: { id: string; name: string };
  location: {
    id: string;
    name: string | null;
    locationCode: string | null;
    locationType: string | null;
  };
};

export type SitePlan = SitePlanListItem & {
  locationId: string;
  url: string;
  width: number | null;
  height: number | null;
  features: PlanFeature[];
};

export type SitePlanList = {
  sitePlanCount: number;
  sitePlans: SitePlanListItem[];
};

export type LocalPlanFeature = {
  key: string;
  id?: string;
  locationId: string;
  location?: PlanFeature["location"];
  geometry: PlanGeometry;
  labelOverride: string | null;
  sortOrder: number;
};

export type DraftRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PlanPoint = readonly [number, number];

export const MIN_PLAN_RECT_DIAGONAL = 0.01;

const MAX_PLAN_BYTES = 25 * 1024 * 1024;

const PLAN_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isPlanImage(contentType: string): boolean {
  return (
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType.startsWith("image/")
  );
}

export function isPlanPdf(contentType: string): boolean {
  return contentType === "application/pdf";
}

export function planFeatureLabel(
  feature: Pick<PlanFeature, "labelOverride" | "location"> | LocalPlanFeature,
): string {
  return (
    feature.labelOverride ??
    feature.location?.name ??
    feature.location?.locationCode ??
    "Room"
  );
}

export function locationDisplayName(
  location: {
    name: string | null;
    locationCode: string | null;
  } | null | undefined,
): string {
  if (!location) {
    return "Untitled location";
  }

  return location.name ?? location.locationCode ?? "Untitled location";
}

export function formatSitePlanDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function toPlanPoint(
  clientX: number,
  clientY: number,
  box: DOMRect,
): PlanPoint {
  const x = (clientX - box.left) / box.width;
  const y = (clientY - box.top) / box.height;

  return [
    Math.min(1, Math.max(0, x)),
    Math.min(1, Math.max(0, y)),
  ] as const;
}

export function rectToPolygon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): PlanGeometry {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);

  return {
    type: "Polygon",
    coordinates: [
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
        [left, top],
      ],
    ],
  };
}

export function draftRectDiagonal(rect: DraftRect): number {
  return Math.hypot(rect.x1 - rect.x0, rect.y1 - rect.y0);
}

export function featuresFromPlan(plan: SitePlan): LocalPlanFeature[] {
  return plan.features.map((feature) => ({
    key: feature.id,
    id: feature.id,
    locationId: feature.locationId,
    location: feature.location,
    geometry: feature.geometry,
    labelOverride: feature.labelOverride,
    sortOrder: feature.sortOrder,
  }));
}

export function featuresPutBody(features: LocalPlanFeature[]) {
  return {
    features: features.map((feature, index) => ({
      locationId: feature.locationId,
      geometry: feature.geometry,
      labelOverride: feature.labelOverride,
      sortOrder: feature.sortOrder ?? index,
    })),
  };
}

export function planFileProblem(file: File): string | null {
  if (file.size <= 0) {
    return "A plan file is required.";
  }

  if (file.size > MAX_PLAN_BYTES) {
    return "Plan must be 25 MB or smaller.";
  }

  const type = file.type || guessContentType(file.name);

  if (!PLAN_CONTENT_TYPES.has(type)) {
    return "Plan must be a PDF, JPEG, PNG, or WebP file.";
  }

  return null;
}

export function parseSitePlanList(data: unknown): SitePlanList {
  const record = objectRecord(data, "site plan list");
  const sitePlans = parseSitePlanListItems(record.sitePlans);

  return {
    sitePlanCount:
      typeof record.sitePlanCount === "number" && Number.isFinite(record.sitePlanCount)
        ? record.sitePlanCount
        : sitePlans.length,
    sitePlans,
  };
}

export function parseSitePlanBody(data: unknown): SitePlan {
  if (!data || typeof data !== "object" || !("sitePlan" in data)) {
    throw new Error("The response was missing a site plan.");
  }

  return parseSitePlan(data.sitePlan);
}

export function parseSitePlan(value: unknown): SitePlan {
  const record = objectRecord(value, "site plan");
  const listItem = parseSitePlanListItem(record);

  return {
    ...listItem,
    locationId: requiredString(record, "locationId"),
    url: requiredString(record, "url"),
    width: optionalNumber(record, "width"),
    height: optionalNumber(record, "height"),
    features: parseFeatures(record.features),
  };
}

function parseSitePlanListItems(value: unknown): SitePlanListItem[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseSitePlanListItem);
}

function parseSitePlanListItem(value: unknown): SitePlanListItem {
  const record = objectRecord(value, "site plan");
  const client = objectRecord(record.client, "client");
  const site = objectRecord(record.site, "site");
  const location = objectRecord(record.location, "location");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    contentType: requiredString(record, "contentType"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
    client: {
      id: requiredString(client, "id"),
      name: requiredString(client, "name"),
    },
    site: {
      id: requiredString(site, "id"),
      name: requiredString(site, "name"),
    },
    location: {
      id: requiredString(location, "id"),
      name: optionalString(location, "name"),
      locationCode: optionalString(location, "locationCode"),
      locationType: optionalString(location, "locationType"),
    },
  };
}

function parseFeatures(value: unknown): PlanFeature[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseFeature).sort((a, b) => a.sortOrder - b.sortOrder);
}

function parseFeature(value: unknown): PlanFeature {
  const record = objectRecord(value, "plan feature");
  const location = objectRecord(record.location, "plan feature location");

  return {
    id: requiredString(record, "id"),
    locationId: requiredString(record, "locationId"),
    location: {
      id: requiredString(location, "id"),
      locationCode: optionalString(location, "locationCode"),
      name: optionalString(location, "name"),
      locationType: optionalString(location, "locationType"),
    },
    geometry: parseGeometry(record.geometry),
    labelOverride: optionalString(record, "labelOverride"),
    sortOrder:
      typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
        ? record.sortOrder
        : 0,
  };
}

function parseGeometry(value: unknown): PlanGeometry {
  const record = objectRecord(value, "plan geometry");

  if (record.type !== "Polygon") {
    throw new Error("The response could not be read.");
  }

  if (!Array.isArray(record.coordinates)) {
    throw new Error("The response could not be read.");
  }

  return {
    type: "Polygon",
    coordinates: record.coordinates.map(parseRing),
  };
}

function parseRing(value: unknown): number[][] {
  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw new Error("The response could not be read.");
    }

    const x = point[0];
    const y = point[1];

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      throw new Error("The response could not be read.");
    }

    return [x, y];
  });
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "";
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

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error("The response could not be read.");
}
