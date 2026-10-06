import type { Address } from "@/lib/clients";

export type SiteContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  telephone: string | null;
};

export type SiteClient = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type Site = {
  id: string;
  name: string;
  reference: string | null;
  address: Address;
  contact: SiteContact;
  createdAt: string;
  updatedAt: string;
};

export type SiteLocation = {
  id: string;
  siteId: string;
  locationCode: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteDetail = Site & {
  client: SiteClient;
  locations: SiteLocation[];
  locationCount: number;
};

export const ASSET_STATUSES = [
  "active",
  "inactive",
  "out_of_service",
  "decommissioned",
  "disposed",
  "proposed",
  "under_installation",
  "awaiting_commissioning",
  "deleted",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type AssetLocation = {
  id: string;
  siteId: string;
  locationCode: string | null;
  name: string | null;
};

export type AssetTypeSummary = {
  id: string;
  code: string;
  name: string;
};

export type Asset = {
  id: string;
  assetRef: string;
  assetName: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  status: AssetStatus;
  location: AssetLocation;
  assetType: AssetTypeSummary;
};

export type AssetList = {
  assetCount: number;
  assets: Asset[];
};

export function parseSite(value: unknown): Site {
  const record = objectRecord(value, "site");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    reference: optionalString(record, "reference"),
    address: parseAddress(record.address),
    contact: parseSiteContact(record.contact),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

export function parseSiteBody(data: unknown): Site {
  return parseSite(readSite(data));
}

export function parseLocationBody(data: unknown): SiteLocation {
  if (!data || typeof data !== "object" || !("location" in data)) {
    throw new Error("The response was missing a location.");
  }

  return parseLocation(data.location);
}

export function parseSiteDetail(data: unknown): SiteDetail {
  const value = readSite(data);
  const record = objectRecord(value, "site");
  const locations = parseLocations(record.locations);

  return {
    ...parseSite(record),
    client: parseSiteClient(record.client),
    locations,
    locationCount: readCount(record.locationCount, locations.length),
  };
}

export function parseAssetList(data: unknown): AssetList {
  const record = objectRecord(data, "asset list");
  const assets = parseAssets(record.assets);

  return {
    assetCount: readCount(record.assetCount, assets.length),
    assets,
  };
}

export function parseAssetBody(data: unknown): Asset {
  if (!data || typeof data !== "object" || !("asset" in data)) {
    throw new Error("The response was missing an asset.");
  }

  return parseAsset(data.asset);
}

export function includeAsset(list: AssetList, asset: Asset): AssetList {
  if (list.assets.some((item) => item.id === asset.id)) {
    return list;
  }

  return {
    assetCount: list.assetCount + 1,
    assets: [...list.assets, asset],
  };
}

function parseLocations(value: unknown): SiteLocation[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseLocation);
}

function parseLocation(value: unknown): SiteLocation {
  const record = objectRecord(value, "location");

  return {
    id: requiredString(record, "id"),
    siteId: requiredString(record, "siteId"),
    locationCode: optionalString(record, "locationCode"),
    name: optionalString(record, "name"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function parseAssets(value: unknown): Asset[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseAsset);
}

function parseAsset(value: unknown): Asset {
  const record = objectRecord(value, "asset");

  return {
    id: requiredString(record, "id"),
    assetRef: requiredString(record, "assetRef"),
    assetName: optionalString(record, "assetName"),
    quantity: optionalNumber(record, "quantity"),
    unitOfMeasure: optionalString(record, "unitOfMeasure"),
    status: parseAssetStatus(record.status),
    location: parseAssetLocation(record.location),
    assetType: parseAssetTypeSummary(record.assetType),
  };
}

function parseAssetLocation(value: unknown): AssetLocation {
  const record = objectRecord(value, "location");

  return {
    id: requiredString(record, "id"),
    siteId: requiredString(record, "siteId"),
    locationCode: optionalString(record, "locationCode"),
    name: optionalString(record, "name"),
  };
}

function parseAssetTypeSummary(value: unknown): AssetTypeSummary {
  const record = objectRecord(value, "asset type");

  return {
    id: requiredString(record, "id"),
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
  };
}

function parseAssetStatus(value: unknown): AssetStatus {
  if (
    typeof value === "string" &&
    (ASSET_STATUSES as readonly string[]).includes(value)
  ) {
    return value as AssetStatus;
  }

  throw new Error("The response could not be read.");
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

function readCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseSiteClient(value: unknown): SiteClient {
  const record = objectRecord(value, "client");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    logoUrl: optionalString(record, "logoUrl"),
  };
}

function parseSiteContact(value: unknown): SiteContact {
  const record = objectRecord(value, "contact");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    role: optionalString(record, "role"),
    email: optionalString(record, "email"),
    telephone: optionalString(record, "telephone"),
  };
}

function parseAddress(value: unknown): Address {
  const record = objectRecord(value, "address");

  return {
    line1: requiredString(record, "line1"),
    line2: optionalString(record, "line2"),
    city: requiredString(record, "city"),
    county: optionalString(record, "county"),
    postcode: requiredString(record, "postcode"),
    country: requiredString(record, "country"),
  };
}

function readSite(data: unknown): unknown {
  if (!data || typeof data !== "object" || !("site" in data)) {
    throw new Error("The response was missing a site.");
  }

  return data.site;
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
