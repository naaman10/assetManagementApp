"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, TextField } from "@/components/form-controls";
import {
  buildLocationTree,
  filterLocationTree,
  flattenLocationTree,
  locationLabel,
  locationStatusLabel,
  locationTypeLabel,
  type Location,
} from "@/lib/locations";

export function LocationTree({
  locations,
}: {
  locations: Location[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const children = buildLocationTree(locations);
  const searching = query.trim().length > 0;
  const rows = searching
    ? filterLocationTree(locations, query)
    : visibleRows(locations, children, expanded);

  if (locations.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No locations yet.</p>;
  }

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="location-tree-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No locations match.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => {
              const hasChildren = (children.get(row.id)?.length ?? 0) > 0;
              const isExpanded = Boolean(expanded[row.id]);

              return (
                <li key={row.id}>
                  <div
                    className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50"
                    style={{ paddingLeft: 16 + row.depth * 16 }}
                  >
                    {searching ? (
                      <span className="w-7 shrink-0" aria-hidden="true" />
                    ) : hasChildren ? (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? `Collapse ${locationLabel(row)}`
                            : `Expand ${locationLabel(row)}`
                        }
                        onClick={() => {
                          setExpanded((current) => ({
                            ...current,
                            [row.id]: !current[row.id],
                          }));
                        }}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100"
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-7 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/locations/${row.id}`}
                        className="text-sm font-medium text-gray-800 hover:text-brand-500"
                      >
                        {locationLabel(row)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone="light">{locationTypeLabel(row.locationType)}</Badge>
                        {row.locationCode ? (
                          <span className="text-xs text-gray-500">{row.locationCode}</span>
                        ) : null}
                        <Badge
                          tone={row.status === "active" ? "success" : "light"}
                        >
                          {locationStatusLabel(row.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function visibleRows(
  locations: Location[],
  children: Map<string | null, Location[]>,
  expanded: Record<string, boolean>,
) {
  const all = flattenLocationTree(locations);
  const byId = new Map(locations.map((location) => [location.id, location]));

  return all.filter((row) => {
    let parentId = row.parentLocationId;

    while (parentId) {
      if (!expanded[parentId]) {
        return false;
      }

      parentId = byId.get(parentId)?.parentLocationId ?? null;
    }

    return true;
  });
}
