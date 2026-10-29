export const PROJECT_STATUSES = ["scheduled", "in_progress", "completed"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_ASSET_REVIEW_STATUSES = ["todo", "in_progress", "done"] as const;

export type ProjectAssetReviewStatus = (typeof PROJECT_ASSET_REVIEW_STATUSES)[number];

export type ProjectUser = {
  id: string;
  email: string;
  name: string | null;
};

export type ProjectClient = {
  id: string;
  name: string;
};

export type ProjectAsset = {
  id: string;
  tag: string;
  assetName: string | null;
  locationId: string;
  reviewStatus: ProjectAssetReviewStatus;
};

export type ProjectSiteAsset = {
  id: string;
  tag: string;
  assetName: string | null;
  reviewStatus: ProjectAssetReviewStatus;
};

export type ProjectLocationNode = {
  id: string;
  parentLocationId: string | null;
  locationCode: string | null;
  name: string | null;
  locationType: string | null;
  status: string;
  assets: ProjectSiteAsset[];
  locations: ProjectLocationNode[];
};

export type ProjectSite = {
  id: string;
  name: string;
  reference: string | null;
  locations: ProjectLocationNode[];
};

export type ProjectTypeRef = {
  id: string;
  code: string;
  name: string;
};

export type Project = {
  id: string;
  title: string;
  projectReference: string;
  projectTypeId: string;
  projectType: ProjectTypeRef;
  status: ProjectStatus;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  lead: ProjectUser | null;
  members: ProjectUser[];
  client: ProjectClient;
  assets: ProjectAsset[];
  sites: ProjectSite[];
};

export type ProjectList = {
  projectCount: number;
  projects: Project[];
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
  tag: string;
  assetName: string | null;
  location: FinderLocation;
};

const statusLabels: Record<ProjectStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

export function projectStatusLabel(status: ProjectStatus): string {
  return statusLabels[status];
}

export function leadLabel(lead: Pick<ProjectUser, "name" | "email"> | null): string {
  if (!lead) {
    return "—";
  }

  return lead.name ?? lead.email;
}

export function formatProjectDate(value: string | null): string {
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

export function parseProjectList(data: unknown): ProjectList {
  const record = objectRecord(data, "project list");
  const projects = parseProjects(record.projects);

  return {
    projectCount: typeof record.projectCount === "number" ? record.projectCount : projects.length,
    projects,
  };
}

export function parseProjectBody(data: unknown): Project {
  if (!data || typeof data !== "object" || !("project" in data)) {
    throw new Error("The response was missing a project.");
  }

  return parseProject(data.project);
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

export function parseLeadUsers(data: unknown): ProjectUser[] {
  return readArray(data, "users").map(parseProjectUser);
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
      tag: requiredString(asset, "tag"),
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

function parseProjects(value: unknown): Project[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseProject);
}

function parseProject(value: unknown): Project {
  const record = objectRecord(value, "project");
  const client = objectRecord(record.client, "client");
  const projectType = objectRecord(record.projectType, "project type");

  return {
    id: requiredString(record, "id"),
    title: requiredString(record, "title"),
    projectReference: requiredString(record, "projectReference"),
    projectTypeId: requiredString(record, "projectTypeId"),
    projectType: {
      id: requiredString(projectType, "id"),
      code: requiredString(projectType, "code"),
      name: requiredString(projectType, "name"),
    },
    status: parseStatus(record.status),
    description: optionalString(record, "description"),
    startDate: optionalString(record, "startDate"),
    dueDate: optionalString(record, "dueDate"),
    lead: record.lead == null ? null : parseProjectUser(record.lead),
    members: parseProjectUsers(record.members),
    client: {
      id: requiredString(client, "id"),
      name: requiredString(client, "name"),
    },
    assets: parseProjectAssets(record.assets),
    sites: parseProjectSites(record.sites),
  };
}

function parseProjectSites(value: unknown): ProjectSite[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item) => {
    const record = objectRecord(item, "site");

    return {
      id: requiredString(record, "id"),
      name: requiredString(record, "name"),
      reference: optionalString(record, "reference"),
      locations: parseProjectLocationNodes(record.locations),
    };
  });
}

function parseProjectLocationNodes(value: unknown): ProjectLocationNode[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map((item) => {
    const record = objectRecord(item, "location");

    return {
      id: requiredString(record, "id"),
      parentLocationId: optionalString(record, "parentLocationId"),
      locationCode: optionalString(record, "locationCode"),
      name: optionalString(record, "name"),
      locationType: optionalString(record, "locationType"),
      status: typeof record.status === "string" ? record.status : "active",
      assets: parseProjectSiteAssets(record.assets),
      locations: parseProjectLocationNodes(record.locations),
    };
  });
}

function parseProjectSiteAssets(value: unknown): ProjectSiteAsset[] {
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
      tag: requiredString(record, "tag"),
      assetName: optionalString(record, "assetName"),
      reviewStatus: parseProjectAssetReviewStatus(record.reviewStatus),
    };
  });
}

export function countProjectSiteAssets(sites: ProjectSite[]): number {
  return sites.reduce((total, site) => total + countLocationAssets(site.locations), 0);
}

export function countProjectLocations(sites: ProjectSite[]): number {
  return sites.reduce((total, site) => total + countLocationNodes(site.locations), 0);
}

function countLocationAssets(nodes: ProjectLocationNode[]): number {
  return nodes.reduce(
    (total, node) => total + node.assets.length + countLocationAssets(node.locations),
    0,
  );
}

function countLocationNodes(nodes: ProjectLocationNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countLocationNodes(node.locations), 0);
}

export function projectLocationLabel(
  location: Pick<ProjectLocationNode, "name" | "locationCode">,
): string {
  return location.name ?? location.locationCode ?? "Untitled location";
}

function parseProjectUsers(value: unknown): ProjectUser[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseProjectUser);
}

function parseProjectAssets(value: unknown): ProjectAsset[] {
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
      tag: requiredString(record, "tag"),
      assetName: optionalString(record, "assetName"),
      locationId: requiredString(record, "locationId"),
      reviewStatus: parseProjectAssetReviewStatus(record.reviewStatus),
    };
  });
}

export function reviewStatusLabel(status: ProjectAssetReviewStatus): string {
  switch (status) {
    case "todo":
      return "To do";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
  }
}

export function parseProjectAssetReviewStatus(value: unknown): ProjectAssetReviewStatus {
  if (
    typeof value === "string" &&
    (PROJECT_ASSET_REVIEW_STATUSES as readonly string[]).includes(value)
  ) {
    return value as ProjectAssetReviewStatus;
  }

  return "todo";
}

export type ProjectAssetReviewPatch = {
  id: string;
  tag: string;
  assetName: string | null;
  locationId: string;
  reviewStatus: ProjectAssetReviewStatus;
};

export function parseProjectAssetReviewBody(data: unknown): ProjectAssetReviewPatch {
  if (!data || typeof data !== "object" || !("asset" in data)) {
    throw new Error("The response was missing an asset.");
  }

  const record = objectRecord(data.asset, "asset");

  return {
    id: requiredString(record, "id"),
    tag: requiredString(record, "tag"),
    assetName: optionalString(record, "assetName"),
    locationId: requiredString(record, "locationId"),
    reviewStatus: parseProjectAssetReviewStatus(record.reviewStatus),
  };
}

function parseProjectUser(value: unknown): ProjectUser {
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

function parseStatus(value: unknown): ProjectStatus {
  if (typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value)) {
    return value as ProjectStatus;
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
