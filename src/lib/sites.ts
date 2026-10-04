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
  address: Address;
  contact: SiteContact;
  createdAt: string;
  updatedAt: string;
};

export type SiteDetail = Site & {
  client: SiteClient;
};

export function parseSite(value: unknown): Site {
  const record = objectRecord(value, "site");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    address: parseAddress(record.address),
    contact: parseSiteContact(record.contact),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

export function parseSiteBody(data: unknown): Site {
  return parseSite(readSite(data));
}

export function parseSiteDetail(data: unknown): SiteDetail {
  const value = readSite(data);
  const record = objectRecord(value, "site");

  return {
    ...parseSite(record),
    client: parseSiteClient(record.client),
  };
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
