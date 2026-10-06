export const AUDIT_STATUSES = ["scheduled", "in_progress", "completed"] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export type AuditUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuditClient = {
  id: string;
  name: string;
};

export type AuditAsset = {
  id: string;
  assetRef: string;
  assetName: string | null;
};

export type Audit = {
  id: string;
  title: string;
  projectReference: string;
  status: AuditStatus;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  lead: AuditUser | null;
  client: AuditClient;
  assets: AuditAsset[];
};

export type AuditList = {
  auditCount: number;
  audits: Audit[];
};

export type NamedOption = {
  id: string;
  name: string;
};

export type ClientSites = {
  id: string;
  name: string;
  sites: NamedOption[];
};

export type FinderLocation = {
  id: string;
  name: string | null;
  locationCode: string | null;
};

export type FinderAsset = {
  id: string;
  assetRef: string;
  assetName: string | null;
  location: FinderLocation;
};

const statusLabels: Record<AuditStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

export function auditStatusLabel(status: AuditStatus): string {
  return statusLabels[status];
}

export function leadLabel(lead: Pick<AuditUser, "name" | "email"> | null): string {
  if (!lead) {
    return "—";
  }

  return lead.name ?? lead.email;
}

export function formatAuditDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return value;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function parseAuditList(data: unknown): AuditList {
  const record = objectRecord(data, "audit list");
  const audits = parseAudits(record.audits);

  return {
    auditCount: typeof record.auditCount === "number" ? record.auditCount : audits.length,
    audits,
  };
}

export function parseAuditBody(data: unknown): Audit {
  if (!data || typeof data !== "object" || !("audit" in data)) {
    throw new Error("The response was missing an audit.");
  }

  return parseAudit(data.audit);
}

export function parseClientChoices(data: unknown): NamedOption[] {
  return readArray(data, "clients").map((value) => {
    const record = objectRecord(value, "client");

    return {
      id: requiredString(record, "id"),
      name: requiredString(record, "name"),
    };
  });
}

export function parseClientSites(data: unknown): ClientSites {
  if (!data || typeof data !== "object" || !("client" in data)) {
    throw new Error("The response was missing a client.");
  }

  const record = objectRecord(data.client, "client");
  const sites = record.sites;

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    sites: Array.isArray(sites) ? sites.map(parseNamedOption) : [],
  };
}

export function parseLeadUsers(data: unknown): AuditUser[] {
  return readArray(data, "users").map(parseAuditUser);
}

export function parseFinderLocations(data: unknown): FinderLocation[] {
  const record = objectRecord(data, "location list");
  const locations = record.locations;

  if (locations == null) {
    return [];
  }

  if (!Array.isArray(locations)) {
    throw new Error("The response could not be read.");
  }

  return locations.map((value) => {
    const location = objectRecord(value, "location");

    return {
      id: requiredString(location, "id"),
      name: optionalString(location, "name"),
      locationCode: optionalString(location, "locationCode"),
    };
  });
}

export function parseFinderAssets(data: unknown): FinderAsset[] {
  const record = objectRecord(data, "asset list");
  const assets = record.assets;

  if (assets == null) {
    return [];
  }

  if (!Array.isArray(assets)) {
    throw new Error("The response could not be read.");
  }

  return assets.map((value) => {
    const asset = objectRecord(value, "asset");
    const location = objectRecord(asset.location, "location");

    return {
      id: requiredString(asset, "id"),
      assetRef: requiredString(asset, "assetRef"),
      assetName: optionalString(asset, "assetName"),
      location: {
        id: requiredString(location, "id"),
        name: optionalString(location, "name"),
        locationCode: optionalString(location, "locationCode"),
      },
    };
  });
}

export function locationOptionLabel(location: FinderLocation): string {
  if (location.name && location.locationCode) {
    return `${location.name} · ${location.locationCode}`;
  }

  return location.name ?? location.locationCode ?? "Location";
}

function parseAudits(value: unknown): Audit[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseAudit);
}

function parseAudit(value: unknown): Audit {
  const record = objectRecord(value, "audit");
  const client = objectRecord(record.client, "client");

  return {
    id: requiredString(record, "id"),
    title: requiredString(record, "title"),
    projectReference: requiredString(record, "projectReference"),
    status: parseStatus(record.status),
    description: optionalString(record, "description"),
    startDate: optionalString(record, "startDate"),
    dueDate: optionalString(record, "dueDate"),
    lead: record.lead == null ? null : parseAuditUser(record.lead),
    client: {
      id: requiredString(client, "id"),
      name: requiredString(client, "name"),
    },
    assets: parseAuditAssets(record.assets),
  };
}

function parseAuditAssets(value: unknown): AuditAsset[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item) => {
    const record = objectRecord(item, "asset");

    return {
      id: requiredString(record, "id"),
      assetRef: requiredString(record, "assetRef"),
      assetName: optionalString(record, "assetName"),
    };
  });
}

function parseAuditUser(value: unknown): AuditUser {
  const record = objectRecord(value, "user");

  return {
    id: requiredString(record, "id"),
    email: requiredString(record, "email"),
    name: optionalString(record, "name"),
  };
}

function parseNamedOption(value: unknown): NamedOption {
  const record = objectRecord(value, "site");

  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
  };
}

function parseStatus(value: unknown): AuditStatus {
  if (typeof value === "string" && (AUDIT_STATUSES as readonly string[]).includes(value)) {
    return value as AuditStatus;
  }

  throw new Error("The response could not be read.");
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

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
