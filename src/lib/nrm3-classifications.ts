export type Nrm3Classification = {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
  maintainableAssetDescription: string | null;
  renewalUom: string | null;
  maintenanceUom: string | null;
  productMaterialType: string | null;
  workPackage: string | null;
  sourceVersion: string;
  sourceRow: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Nrm3TreeRow = Nrm3Classification & {
  depth: number;
};

export function parseNrm3ClassificationList(data: unknown): Nrm3Classification[] {
  if (!data || typeof data !== "object") {
    throw new Error("The response could not be read.");
  }

  if (!("nrm3Classifications" in data) || data.nrm3Classifications == null) {
    return [];
  }

  if (!Array.isArray(data.nrm3Classifications)) {
    throw new Error("The response could not be read.");
  }

  return data.nrm3Classifications.map(parseNrm3Classification);
}

export function parseNrm3ClassificationBody(data: unknown): Nrm3Classification {
  if (!data || typeof data !== "object" || !("nrm3Classification" in data)) {
    throw new Error("The response was missing an NRM3 classification.");
  }

  return parseNrm3Classification(data.nrm3Classification);
}

export function nrm3Label(
  row: Pick<Nrm3Classification, "code" | "name"> | null | undefined,
): string {
  if (!row) {
    return "—";
  }

  return `${row.code} · ${row.name}`;
}

export function buildNrm3Tree(
  rows: Nrm3Classification[],
): Map<string | null, Nrm3Classification[]> {
  const children = new Map<string | null, Nrm3Classification[]>();

  for (const row of rows) {
    const key = row.parentCode;
    const list = children.get(key);

    if (list) {
      list.push(row);
    } else {
      children.set(key, [row]);
    }
  }

  for (const list of children.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }

  return children;
}

export function flattenNrm3Tree(rows: Nrm3Classification[]): Nrm3TreeRow[] {
  const children = buildNrm3Tree(rows);
  const codes = new Set(rows.map((row) => row.code));
  const roots = (children.get(null) ?? []).concat(
    rows.filter((row) => row.parentCode != null && !codes.has(row.parentCode)),
  );
  const result: Nrm3TreeRow[] = [];

  function walk(node: Nrm3Classification, depth: number) {
    result.push({ ...node, depth });

    for (const child of children.get(node.code) ?? []) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots.sort((a, b) => a.code.localeCompare(b.code))) {
    walk(root, 0);
  }

  return result;
}

export function filterNrm3Tree(
  rows: Nrm3Classification[],
  query: string,
): Nrm3TreeRow[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return flattenNrm3Tree(rows);
  }

  const byCode = new Map(rows.map((row) => [row.code, row]));
  const keep = new Set<string>();

  for (const row of rows) {
    if (
      row.code.toLowerCase().includes(needle) ||
      row.name.toLowerCase().includes(needle)
    ) {
      keep.add(row.code);
      let parentCode = row.parentCode;

      while (parentCode) {
        keep.add(parentCode);
        parentCode = byCode.get(parentCode)?.parentCode ?? null;
      }
    }
  }

  return flattenNrm3Tree(rows.filter((row) => keep.has(row.code)));
}

function parseNrm3Classification(value: unknown): Nrm3Classification {
  const record = objectRecord(value, "NRM3 classification");

  return {
    code: requiredString(record, "code"),
    name: requiredString(record, "name"),
    level: requiredInteger(record, "level"),
    parentCode: optionalString(record, "parentCode"),
    maintainableAssetDescription: optionalString(record, "maintainableAssetDescription"),
    renewalUom: optionalString(record, "renewalUom"),
    maintenanceUom: optionalString(record, "maintenanceUom"),
    productMaterialType: optionalString(record, "productMaterialType"),
    workPackage: optionalString(record, "workPackage"),
    sourceVersion: requiredString(record, "sourceVersion"),
    sourceRow: optionalInteger(record, "sourceRow"),
    createdAt: optionalString(record, "createdAt") ?? "",
    updatedAt: optionalString(record, "updatedAt") ?? "",
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

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
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

function optionalInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("The response could not be read.");
  }

  return value;
}
