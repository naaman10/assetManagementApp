"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, TextField } from "@/components/form-controls";
import { ReviewStatusBadge } from "@/components/projects/review-status-badge";
import {
  LOCATION_STATUSES,
  LOCATION_TYPES,
  locationStatusLabel,
  locationTypeLabel,
  type LocationStatus,
  type LocationType,
} from "@/lib/locations";
import {
  projectLocationLabel,
  type ProjectLocationNode,
  type ProjectSite,
  type ProjectSiteAsset,
} from "@/lib/projects";

export function ProjectSitesTree({
  sites,
  projectId,
}: {
  sites: ProjectSite[];
  projectId: string;
}) {
  const [query, setQuery] = useState("");
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sites.map((site) => [site.id, true])),
  );
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const needle = query.trim().toLowerCase();

  if (sites.length === 0) {
    return <p className="text-sm text-gray-500">No locations yet.</p>;
  }

  const visibleSites = sites
    .map((site) => ({
      site,
      locations: needle ? filterLocationNodes(site.locations, needle) : site.locations,
    }))
    .filter(
      ({ site, locations }) =>
        !needle ||
        site.name.toLowerCase().includes(needle) ||
        (site.reference?.toLowerCase().includes(needle) ?? false) ||
        locations.length > 0,
    );

  return (
    <div className="grid gap-4">
      <div className="max-w-md">
        <TextField
          id="project-locations-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {visibleSites.length === 0 ? (
        <p className="text-sm text-gray-500">No locations match.</p>
      ) : (
        <div className="grid gap-4">
          {visibleSites.map(({ site, locations }) => {
            const siteExpanded = Boolean(expandedSites[site.id]) || Boolean(needle);
            const assetCount = countNodesAssets(locations);

            return (
              <div
                key={site.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs"
              >
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={siteExpanded}
                    aria-label={siteExpanded ? `Collapse ${site.name}` : `Expand ${site.name}`}
                    onClick={() => {
                      setExpandedSites((current) => ({
                        ...current,
                        [site.id]: !current[site.id],
                      }));
                    }}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100"
                  >
                    {siteExpanded ? "▾" : "▸"}
                  </button>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/sites/${site.id}`}
                      className="text-sm font-medium text-gray-800 hover:text-brand-500"
                    >
                      {site.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {site.reference ? <span>{site.reference}</span> : null}
                      <span>
                        {assetCount.toLocaleString()} asset{assetCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
                {siteExpanded ? (
                  locations.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-500">No locations in this site.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {flattenVisible(locations, expandedLocations, Boolean(needle)).map(
                        (row) => (
                          <LocationRow
                            key={row.node.id}
                            node={row.node}
                            depth={row.depth}
                            projectId={projectId}
                            searching={Boolean(needle)}
                            expanded={Boolean(expandedLocations[row.node.id])}
                            onToggle={() => {
                              setExpandedLocations((current) => ({
                                ...current,
                                [row.node.id]: !current[row.node.id],
                              }));
                            }}
                          />
                        ),
                      )}
                    </ul>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LocationRow({
  node,
  depth,
  projectId,
  searching,
  expanded,
  onToggle,
}: {
  node: ProjectLocationNode;
  depth: number;
  projectId: string;
  searching: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = node.locations.length > 0 || node.assets.length > 0;
  const showChildren = searching || expanded;

  return (
    <li>
      <div
        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50"
        style={{ paddingLeft: 16 + depth * 16 }}
      >
        {searching ? (
          <span className="w-7 shrink-0" aria-hidden="true" />
        ) : hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Collapse ${projectLocationLabel(node)}`
                : `Expand ${projectLocationLabel(node)}`
            }
            onClick={onToggle}
            className="grid size-7 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/locations/${node.id}`}
            className="text-sm font-medium text-gray-800 hover:text-brand-500"
          >
            {projectLocationLabel(node)}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="light">{asLocationTypeLabel(node.locationType)}</Badge>
            {node.locationCode ? (
              <span className="text-xs text-gray-500">{node.locationCode}</span>
            ) : null}
            <Badge tone={node.status === "active" ? "success" : "light"}>
              {asLocationStatusLabel(node.status)}
            </Badge>
            {node.assets.length > 0 ? (
              <span className="text-xs text-gray-500">
                {node.assets.length.toLocaleString()} asset
                {node.assets.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {showChildren && node.assets.length > 0 ? (
        <ul className="divide-y divide-gray-50 bg-gray-50/60">
          {node.assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              depth={depth + 1}
              projectId={projectId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AssetRow({
  asset,
  depth,
  projectId,
}: {
  asset: ProjectSiteAsset;
  depth: number;
  projectId: string;
}) {
  return (
    <li
      className="flex items-center gap-2 px-4 py-2.5"
      style={{ paddingLeft: 16 + depth * 16 + 28 }}
    >
      <Link
        href={`/projects/${projectId}/assets/${asset.id}`}
        className="shrink-0 text-sm font-medium text-brand-500 hover:underline"
      >
        {asset.tag}
      </Link>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
        {asset.assetName ?? "—"}
      </span>
      <ReviewStatusBadge status={asset.reviewStatus} />
    </li>
  );
}

function flattenVisible(
  nodes: ProjectLocationNode[],
  expanded: Record<string, boolean>,
  searching: boolean,
  depth = 0,
): Array<{ node: ProjectLocationNode; depth: number }> {
  const rows: Array<{ node: ProjectLocationNode; depth: number }> = [];

  for (const node of nodes) {
    rows.push({ node, depth });

    if (searching || expanded[node.id]) {
      rows.push(...flattenVisible(node.locations, expanded, searching, depth + 1));
    }
  }

  return rows;
}

function filterLocationNodes(
  nodes: ProjectLocationNode[],
  needle: string,
): ProjectLocationNode[] {
  const result: ProjectLocationNode[] = [];

  for (const node of nodes) {
    const childMatches = filterLocationNodes(node.locations, needle);
    const assetMatches = node.assets.filter(
      (asset) =>
        asset.tag.toLowerCase().includes(needle) ||
        (asset.assetName?.toLowerCase().includes(needle) ?? false),
    );
    const selfMatch =
      projectLocationLabel(node).toLowerCase().includes(needle) ||
      (node.locationCode?.toLowerCase().includes(needle) ?? false);

    if (selfMatch || childMatches.length > 0 || assetMatches.length > 0) {
      result.push({
        ...node,
        assets: selfMatch || assetMatches.length > 0 ? (selfMatch ? node.assets : assetMatches) : [],
        locations: childMatches,
      });
    }
  }

  return result;
}

function countNodesAssets(nodes: ProjectLocationNode[]): number {
  return nodes.reduce(
    (total, node) => total + node.assets.length + countNodesAssets(node.locations),
    0,
  );
}

function asLocationTypeLabel(value: string | null): string {
  if (value && (LOCATION_TYPES as readonly string[]).includes(value)) {
    return locationTypeLabel(value as LocationType);
  }

  return locationTypeLabel(null);
}

function asLocationStatusLabel(value: string): string {
  if ((LOCATION_STATUSES as readonly string[]).includes(value)) {
    return locationStatusLabel(value as LocationStatus);
  }

  return value;
}
