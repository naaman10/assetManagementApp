import { parseSite, type Site } from "@/lib/sites";

export type Address = {
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string;
};

export type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  telephone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  name: string;
  logoUrl: string | null;
  address: Address;
  contacts: Contact[];
  sites: Site[];
  createdAt: string;
  updatedAt: string;
};

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function parseClientList(data: unknown): Client[] {
  return readArray(data, "clients").map(parseClient);
}

export function parseClientBody(data: unknown): Client {
  if (!data || typeof data !== "object" || !("client" in data)) {
    throw new Error("The response was missing a client.");
  }

  return parseClient(data.client);
}

export function safeLogoUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function logoFileProblem(bytes: Uint8Array, size: number): string | null {
  if (size <= 0) {
    return "A logo image is required.";
  }

  if (size > MAX_LOGO_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }

  if (!isLogoImage(bytes)) {
    return "Logo must be a JPEG, PNG, or WebP image.";
  }

  return null;
}

function isLogoImage(bytes: Uint8Array): boolean {
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

function parseClient(value: unknown): Client {
  const record = objectRecord(value, "client");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    logoUrl: optionalString(record, "logoUrl"),
    address: parseAddress(record.address),
    contacts: Array.isArray(record.contacts)
      ? record.contacts.map(parseContact)
      : [],
    sites: Array.isArray(record.sites) ? record.sites.map(parseSite) : [],
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
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

function parseContact(value: unknown): Contact {
  const record = objectRecord(value, "contact");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    role: optionalString(record, "role"),
    email: optionalString(record, "email"),
    telephone: optionalString(record, "telephone"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
  };
}

function readArray(data: unknown, key: string): unknown[] {
  if (!data || typeof data !== "object" || !(key in data)) {
    throw new Error("The response could not be read.");
  }

  const value = data[key as keyof typeof data];

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
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
