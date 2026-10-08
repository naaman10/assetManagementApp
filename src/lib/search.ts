export type SearchClient = {
  id: string;
  name: string;
};

type SearchResultBase = {
  id: string;
  name: string;
  client: SearchClient;
};

export type SiteSearchResult = SearchResultBase & {
  type: "site";
};

export type LocationSearchResult = SearchResultBase & {
  type: "location";
  siteId: string;
  locationCode: string;
};

export type AssetSearchResult = SearchResultBase & {
  type: "asset";
  assetRef: string;
  locationId: string;
};

export type WorkOrderSearchResult = SearchResultBase & {
  type: "workOrder";
  assetId: string;
};

export type SearchResult =
  | SiteSearchResult
  | LocationSearchResult
  | AssetSearchResult
  | WorkOrderSearchResult;

const typeLabels: Record<SearchResult["type"], string> = {
  site: "Site",
  location: "Location",
  asset: "Asset",
  workOrder: "Work order",
};

export function searchResultTypeLabel(type: SearchResult["type"]): string {
  return typeLabels[type];
}

export function searchResultHref(result: SearchResult): string {
  switch (result.type) {
    case "site":
      return `/sites/${result.id}`;
    case "location":
      return `/locations/${result.id}`;
    case "asset":
      return `/assets/${result.id}`;
    case "workOrder":
      return `/work-orders?order=${encodeURIComponent(result.id)}`;
  }
}

export function searchResultExtra(result: SearchResult): string | null {
  if (result.type === "asset" && result.name !== result.assetRef) {
    return result.assetRef;
  }

  if (result.type === "location" && result.name !== result.locationCode) {
    return result.locationCode;
  }

  return null;
}

export function parseSearchResults(data: unknown): SearchResult[] {
  const record = objectRecord(data, "search response");
  const results = record.results;

  if (!Array.isArray(results)) {
    throw new Error("The response could not be read.");
  }

  return results.slice(0, 20).map(parseSearchResult);
}

function parseSearchResult(value: unknown): SearchResult {
  const record = objectRecord(value, "search result");
  const type = record.type;
  const base = {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    client: parseClient(record.client),
  };

  if (type === "site") {
    return { type, ...base };
  }

  if (type === "location") {
    return {
      type,
      ...base,
      siteId: requiredString(record, "siteId"),
      locationCode: requiredString(record, "locationCode"),
    };
  }

  if (type === "asset") {
    return {
      type,
      ...base,
      assetRef: requiredString(record, "assetRef"),
      locationId: requiredString(record, "locationId"),
    };
  }

  if (type === "workOrder") {
    return {
      type,
      ...base,
      assetId: requiredString(record, "assetId"),
    };
  }

  throw new Error("The response could not be read.");
}

function parseClient(value: unknown): SearchClient {
  const record = objectRecord(value, "client");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
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
