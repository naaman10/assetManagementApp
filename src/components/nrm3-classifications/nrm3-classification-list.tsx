"use client";

import { useState } from "react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import {
  DataTable,
  PageHeading,
  TextField,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  filterNrm3Tree,
  nrm3Label,
  parseNrm3ClassificationList,
  type Nrm3Classification,
} from "@/lib/nrm3-classifications";
import {
  NRM3_CLASSIFICATIONS_CREATE,
  NRM3_CLASSIFICATIONS_VIEW,
  hasPermission,
} from "@/lib/session";

export function Nrm3ClassificationList() {
  const { user } = useSession();
  const canView = hasPermission(user, NRM3_CLASSIFICATIONS_VIEW);
  const canCreate = hasPermission(user, NRM3_CLASSIFICATIONS_CREATE);
  const rootsRequest = useApi(
    canView ? "/api/nrm3-classifications?parentCode=" : null,
    parseNrm3ClassificationList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="NRM3 classifications"
        action={
          canCreate ? (
            <Link href="/nrm3-classifications/new" className={primaryButtonClassName}>
              New classification
            </Link>
          ) : null
        }
      />
      {rootsRequest.loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading classifications…</p>
      ) : null}
      {rootsRequest.error ? (
        rootsRequest.error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={rootsRequest.error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(rootsRequest.error).message}
          </p>
        )
      ) : null}
      {rootsRequest.data ? <ClassificationRows roots={rootsRequest.data} /> : null}
    </section>
  );
}

function ClassificationRows({ roots }: { roots: Nrm3Classification[] }) {
  const [query, setQuery] = useState("");
  const [catalogPath, setCatalogPath] = useState<string | null>(null);
  const [childrenByParent, setChildrenByParent] = useState<
    Record<string, Nrm3Classification[]>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({});
  const [childError, setChildError] = useState<string | null>(null);
  const catalogRequest = useApi(catalogPath, parseNrm3ClassificationList);
  const searching = query.trim().length > 0;
  const allRows = catalogRequest.data;

  async function toggleExpand(code: string) {
    if (expanded[code]) {
      setExpanded((current) => ({ ...current, [code]: false }));
      return;
    }

    setExpanded((current) => ({ ...current, [code]: true }));

    if (childrenByParent[code]) {
      return;
    }

    setLoadingChildren((current) => ({ ...current, [code]: true }));
    setChildError(null);

    try {
      const data = parseNrm3ClassificationList(
        await apiRequest(
          `/api/nrm3-classifications?parentCode=${encodeURIComponent(code)}`,
        ),
      );
      setChildrenByParent((current) => ({ ...current, [code]: data }));
    } catch (error) {
      setChildError(asApiError(error).message);
      setExpanded((current) => ({ ...current, [code]: false }));
    } finally {
      setLoadingChildren((current) => ({ ...current, [code]: false }));
    }
  }

  if (roots.length === 0 && !searching) {
    return <p className="mt-6 text-sm text-gray-500">No NRM3 classifications yet.</p>;
  }

  const parentLookup = new Map(
    (allRows ?? Object.values(childrenByParent).flat().concat(roots)).map((row) => [
      row.code,
      row,
    ]),
  );

  const browseRows = flattenBrowse(roots, childrenByParent, expanded);
  const searchRows = allRows ? filterNrm3Tree(allRows, query) : [];

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="nrm3-search"
          label="Search"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);

            if (next.trim() && !catalogPath) {
              setCatalogPath("/api/nrm3-classifications");
            }
          }}
        />
      </div>
      {childError ? (
        <p className="mt-4 text-sm text-error-600" role="alert">
          {childError}
        </p>
      ) : null}
      {searching ? (
        catalogRequest.loading ? (
          <p className="mt-6 text-sm text-gray-500">Searching classifications…</p>
        ) : catalogRequest.error ? (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(catalogRequest.error).message}
          </p>
        ) : searchRows.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">No classifications match.</p>
        ) : (
          <DataTable columns={["", "Code", "Name", "Level", "Parent"]}>
            {searchRows.map((row) => (
              <ClassificationRow
                key={row.code}
                row={row}
                depth={row.depth}
                parentLabel={parentLabel(row.parentCode, parentLookup)}
              />
            ))}
          </DataTable>
        )
      ) : (
        <DataTable columns={["", "Code", "Name", "Level", "Parent"]}>
          {browseRows.map(({ row, depth }) => (
            <ClassificationRow
              key={row.code}
              row={row}
              depth={depth}
              parentLabel={parentLabel(row.parentCode, parentLookup)}
              expandable
              expanded={Boolean(expanded[row.code])}
              loadingChildren={Boolean(loadingChildren[row.code])}
              onToggle={() => {
                void toggleExpand(row.code);
              }}
            />
          ))}
        </DataTable>
      )}
    </>
  );
}

function ClassificationRow({
  row,
  depth,
  parentLabel: parent,
  expandable,
  expanded,
  loadingChildren,
  onToggle,
}: {
  row: Nrm3Classification;
  depth: number;
  parentLabel: string;
  expandable?: boolean;
  expanded?: boolean;
  loadingChildren?: boolean;
  onToggle?: () => void;
}) {
  const href = `/nrm3-classifications/${encodeURIComponent(row.code)}`;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-4 text-sm text-gray-500">
        {expandable ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${row.code}` : `Expand ${row.code}`}
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            {loadingChildren ? "…" : expanded ? "▾" : "▸"}
          </button>
        ) : null}
      </td>
      <td className="px-5 py-4 text-sm text-gray-500" style={{ paddingLeft: 20 + depth * 12 }}>
        {row.code}
      </td>
      <td className="px-5 py-4">
        <Link href={href} className="text-sm font-medium text-gray-800">
          {row.name}
        </Link>
      </td>
      <td className="px-5 py-4 text-sm text-gray-500">{row.level}</td>
      <td className="px-5 py-4 text-sm text-gray-500">{parent}</td>
    </tr>
  );
}

function flattenBrowse(
  roots: Nrm3Classification[],
  childrenByParent: Record<string, Nrm3Classification[]>,
  expanded: Record<string, boolean>,
): Array<{ row: Nrm3Classification; depth: number }> {
  const result: Array<{ row: Nrm3Classification; depth: number }> = [];

  function walk(rows: Nrm3Classification[], depth: number) {
    for (const row of rows) {
      result.push({ row, depth });

      if (expanded[row.code] && childrenByParent[row.code]) {
        walk(childrenByParent[row.code], depth + 1);
      }
    }
  }

  walk(roots, 0);
  return result;
}

function parentLabel(
  parentCode: string | null,
  lookup: Map<string, Nrm3Classification>,
): string {
  if (!parentCode) {
    return "—";
  }

  const parent = lookup.get(parentCode);
  return parent ? nrm3Label(parent) : parentCode;
}
