export const LOCATION_TYPES = ["building", "floor", "room", "area"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_STATUSES = ["active", "inactive", "demolished"] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export type LocationParentSummary = {
  id: string;
  locationCode: string | null;
  name: string | null;
  locationType: LocationType | null;
};

export type Location = {
  id: string;
  siteId: string;
  parentLocationId: string | null;
  parentLocation: LocationParentSummary | null;
  locationCode: string | null;
  name: string | null;
  locationType: LocationType | null;
  description: string | null;
  department: string | null;
  uprn: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string };
};

export type LocationList = {
  locationCount: number;
  locations: Location[];
};

export type LocationTreeRow = Location & {
  depth: number;
};

const typeLabels: Record<LocationType, string> = {
  building: "Building",
  floor: "Floor",
  room: "Room",
  area: "Area",
};

const statusLabels: Record<LocationStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  demolished: "Demolished",
};

export function locationLabel(
  location: Pick<Location, "name" | "locationCode"> | null | undefined,
): string {
  if (!location) {
    return "Untitled location";
  }

  return location.name ?? location.locationCode ?? "Untitled location";
}

export function locationTypeLabel(type: LocationType | null | undefined): string {
  if (!type) {
    return "Unclassified";
  }

  return typeLabels[type];
}

export function locationStatusLabel(status: LocationStatus): string {
  return statusLabels[status];
}

export function buildLocationTree(
  locations: Location[],
): Map<string | null, Location[]> {
  const children = new Map<string | null, Location[]>();

  for (const location of locations) {
    const key = location.parentLocationId;
    const list = children.get(key);

    if (list) {
      list.push(location);
    } else {
      children.set(key, [location]);
    }
  }

  for (const list of children.values()) {
    list.sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)));
  }

  return children;
}

export function flattenLocationTree(locations: Location[]): LocationTreeRow[] {
  const children = buildLocationTree(locations);
  const ids = new Set(locations.map((location) => location.id));
  const roots = (children.get(null) ?? []).concat(
    locations.filter(
      (location) =>
        location.parentLocationId != null && !ids.has(location.parentLocationId),
    ),
  );
  const result: LocationTreeRow[] = [];

  function walk(node: Location, depth: number) {
    result.push({ ...node, depth });

    for (const child of children.get(node.id) ?? []) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots.sort((a, b) =>
    locationLabel(a).localeCompare(locationLabel(b)),
  )) {
    walk(root, 0);
  }

  return result;
}

export function filterLocationTree(
  locations: Location[],
  query: string,
): LocationTreeRow[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return flattenLocationTree(locations);
  }

  const byId = new Map(locations.map((location) => [location.id, location]));
  const keep = new Set<string>();

  for (const location of locations) {
    const haystack = [
      location.name,
      location.locationCode,
      locationTypeLabel(location.locationType),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (haystack.includes(needle)) {
      keep.add(location.id);
      let parentId = location.parentLocationId;

      while (parentId) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parentLocationId ?? null;
      }
    }
  }

  return flattenLocationTree(locations.filter((location) => keep.has(location.id)));
}

export function locationPath(
  locations: Location[],
  locationId: string,
): Location[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const path: Location[] = [];
  let current = byId.get(locationId) ?? null;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentLocationId
      ? (byId.get(current.parentLocationId) ?? null)
      : null;
  }

  return path;
}

export function locationPathLabel(
  locations: Location[],
  locationId: string,
): string {
  const path = locationPath(locations, locationId);

  if (path.length === 0) {
    return "—";
  }

  return path.map(locationLabel).join(" / ");
}

/** Compact “leaf · parent” for narrow columns; falls back to leaf or untitled. */
export function locationCompactLabel(
  locations: Location[],
  locationId: string,
  fallback?: Pick<Location, "name" | "locationCode"> | null,
): string {
  const path = locationPath(locations, locationId);

  if (path.length === 0) {
    if (!fallback) {
      return "—";
    }

    return locationLabel(fallback);
  }

  if (path.length === 1) {
    return locationLabel(path[0]);
  }

  const leaf = path[path.length - 1]!;
  const parent = path[path.length - 2]!;
  return `${locationLabel(leaf)} · ${locationLabel(parent)}`;
}

/** Parent type constraints for a child location type. `"root"` means site root only. */
export function allowedParentTypes(
  childType: LocationType | null,
): Array<LocationType | "root"> {
  if (childType == null || childType === "building") {
    return ["root"];
  }

  if (childType === "floor") {
    return ["building"];
  }

  if (childType === "room") {
    return ["floor", "building"];
  }

  // area
  return ["root", "building", "floor", "area"];
}

/** Child types that may nest under a parent location type. Empty for room / unclassified. */
export function allowedChildTypes(
  parentType: LocationType | null,
): LocationType[] {
  if (parentType === "building") {
    return ["floor", "room", "area"];
  }

  if (parentType === "floor") {
    return ["room", "area"];
  }

  if (parentType === "area") {
    return ["area"];
  }

  return [];
}

/** Locations that can be reparented under `parent` (same site, type rules, no cycles). */
export function filterChildLocationCandidates(
  locations: Location[],
  parent: Pick<Location, "id" | "siteId" | "locationType">,
): Location[] {
  const allowed = new Set(allowedChildTypes(parent.locationType));

  if (allowed.size === 0) {
    return [];
  }

  const excluded = descendantIds(locations, parent.id);
  excluded.add(parent.id);

  return locations.filter((location) => {
    if (excluded.has(location.id)) {
      return false;
    }

    if (location.siteId !== parent.siteId) {
      return false;
    }

    if (location.parentLocationId === parent.id) {
      return false;
    }

    if (location.locationType == null || !allowed.has(location.locationType)) {
      return false;
    }

    return true;
  });
}

export function filterParentCandidates(
  locations: Location[],
  options: {
    childType: LocationType | null;
    excludeId?: string;
  },
): Location[] {
  const allowed = allowedParentTypes(options.childType);

  if (allowed.length === 1 && allowed[0] === "root") {
    return [];
  }

  const typeSet = new Set(
    allowed.filter((item): item is LocationType => item !== "root"),
  );
  const excluded = options.excludeId
    ? descendantIds(locations, options.excludeId)
    : new Set<string>();

  if (options.excludeId) {
    excluded.add(options.excludeId);
  }

  return locations.filter((location) => {
    if (excluded.has(location.id)) {
      return false;
    }

    if (location.locationType == null) {
      return false;
    }

    return typeSet.has(location.locationType);
  });
}

export function parentRequiresRoot(childType: LocationType | null): boolean {
  const allowed = allowedParentTypes(childType);
  return allowed.length === 1 && allowed[0] === "root";
}

export function parentAllowsRoot(childType: LocationType | null): boolean {
  return allowedParentTypes(childType).includes("root");
}

export function locationAndDescendantIds(
  locations: Location[],
  rootId: string,
): string[] {
  return [rootId, ...descendantIds(locations, rootId)];
}

function descendantIds(locations: Location[], rootId: string): Set<string> {
  const children = buildLocationTree(locations);
  const excluded = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const id = stack.pop()!;

    for (const child of children.get(id) ?? []) {
      if (!excluded.has(child.id)) {
        excluded.add(child.id);
        stack.push(child.id);
      }
    }
  }

  return excluded;
}

export function parseLocationList(data: unknown): LocationList {
  const record = objectRecord(data, "location list");
  const locations = parseLocations(record.locations);

  return {
    locationCount:
      typeof record.locationCount === "number" && Number.isFinite(record.locationCount)
        ? record.locationCount
        : locations.length,
    locations,
  };
}

export function parseLocationBody(data: unknown): Location {
  if (!data || typeof data !== "object" || !("location" in data)) {
    throw new Error("The response was missing a location.");
  }

  return parseLocation(data.location);
}

export function parseLocations(value: unknown): Location[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseLocation);
}

export function parseLocation(value: unknown): Location {
  const record = objectRecord(value, "location");

  return {
    id: requiredString(record, "id"),
    siteId: requiredString(record, "siteId"),
    parentLocationId: optionalString(record, "parentLocationId"),
    parentLocation: parseParentLocation(record.parentLocation),
    locationCode: optionalString(record, "locationCode"),
    name: optionalString(record, "name"),
    locationType: parseLocationType(record.locationType),
    description: optionalString(record, "description"),
    department: optionalString(record, "department"),
    uprn: optionalString(record, "uprn"),
    address: optionalString(record, "address"),
    latitude: optionalNumber(record, "latitude"),
    longitude: optionalNumber(record, "longitude"),
    status: parseLocationStatus(record.status),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
    ...(record.client == null
      ? {}
      : {
          client: {
            id: requiredString(objectRecord(record.client, "client"), "id"),
            name: requiredString(objectRecord(record.client, "client"), "name"),
          },
        }),
  };
}

function parseParentLocation(value: unknown): LocationParentSummary | null {
  if (value == null) {
    return null;
  }

  const record = objectRecord(value, "parent location");

  return {
    id: requiredString(record, "id"),
    locationCode: optionalString(record, "locationCode"),
    name: optionalString(record, "name"),
    locationType: parseLocationType(record.locationType),
  };
}

function parseLocationType(value: unknown): LocationType | null {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "string" && (LOCATION_TYPES as readonly string[]).includes(value)) {
    return value as LocationType;
  }

  throw new Error("The response could not be read.");
}

function parseLocationStatus(value: unknown): LocationStatus {
  if (value == null || value === "") {
    return "active";
  }

  if (
    typeof value === "string" &&
    (LOCATION_STATUSES as readonly string[]).includes(value)
  ) {
    return value as LocationStatus;
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
