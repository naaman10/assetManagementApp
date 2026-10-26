"use client";

import { useState } from "react";
import { Badge, TextField, inputClassName } from "@/components/form-controls";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  buildLocationTree,
  filterLocationTree,
  flattenLocationTree,
  locationAndDescendantIds,
  locationLabel,
  locationStatusLabel,
  locationTypeLabel,
  parseLocationList,
  type Location,
} from "@/lib/locations";
import {
  locationOptionLabel,
  parseFinderAssets,
  parseFinderLocations,
  type FinderAsset,
  type NamedOption,
} from "@/lib/projects";

const modes = [
  { id: "asset", label: "Individual assets" },
  { id: "site", label: "By site" },
  { id: "location", label: "By location" },
] as const;

type FinderMode = (typeof modes)[number]["id"];

export function AssetFinder({
  clientName,
  sites,
  chosen,
  onChange,
}: {
  clientName: string;
  sites: NamedOption[];
  chosen: FinderAsset[];
  onChange: (assets: FinderAsset[] | ((current: FinderAsset[]) => FinderAsset[])) => void;
}) {
  const [mode, setMode] = useState<FinderMode>("asset");
  const [siteId, setSiteId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [selectionForSite, setSelectionForSite] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [locationAssetIds, setLocationAssetIds] = useState<Record<string, string[]>>({});
  const [locationPending, setLocationPending] = useState<Record<string, boolean>>({});
  const [locationError, setLocationError] = useState<string | null>(null);
  const flatLocationsRequest = useApi(
    siteId && mode !== "location" ? `/api/sites/${siteId}/locations` : null,
    parseFinderLocations,
  );
  const treeLocationsRequest = useApi(
    siteId && mode === "location" ? `/api/sites/${siteId}/locations` : null,
    parseLocationList,
  );
  const assetsRequest = useApi(
    mode === "location" ? null : assetPath(mode, siteId, locationId),
    parseFinderAssets,
  );
  const site = sites.find((item) => item.id === siteId) ?? null;
  const treeLocations = treeLocationsRequest.data?.locations ?? [];

  if (siteId !== selectionForSite) {
    setSelectionForSite(siteId);
    setLocationId("");
    setSelectedLocationIds([]);
    setLocationAssetIds({});
    setLocationPending({});
    setLocationError(null);
  }

  function addAssets(incoming: FinderAsset[]) {
    onChange((current) => {
      const seen = new Set(current.map((asset) => asset.id));
      const next = [...current];

      for (const asset of incoming) {
        if (seen.has(asset.id)) {
          continue;
        }

        seen.add(asset.id);
        next.push(asset);
      }

      return next;
    });
  }

  function toggleAsset(asset: FinderAsset, selected: boolean) {
    if (selected) {
      addAssets([asset]);
      return;
    }

    onChange((current) => current.filter((item) => item.id !== asset.id));
  }

  async function toggleLocation(location: Location, selected: boolean) {
    if (locationPending[location.id]) {
      return;
    }

    if (!selected) {
      const ids = new Set(locationAssetIds[location.id] ?? []);
      const remainingByLocation = { ...locationAssetIds };
      delete remainingByLocation[location.id];
      const stillSelected = new Set(Object.values(remainingByLocation).flat());

      setSelectedLocationIds((current) => current.filter((id) => id !== location.id));
      setLocationAssetIds(remainingByLocation);
      onChange((current) =>
        current.filter((asset) => !ids.has(asset.id) || stillSelected.has(asset.id)),
      );
      setLocationError(null);
      return;
    }

    setLocationPending((current) => ({ ...current, [location.id]: true }));
    setLocationError(null);

    try {
      const subtreeIds = locationAndDescendantIds(treeLocations, location.id);
      const batches = await Promise.all(
        subtreeIds.map(async (id) =>
          parseFinderAssets(await apiRequest(`/api/locations/${id}/assets`)),
        ),
      );
      const assets = batches.flat();
      setSelectedLocationIds((current) =>
        current.includes(location.id) ? current : [...current, location.id],
      );
      setLocationAssetIds((current) => ({
        ...current,
        [location.id]: assets.map((asset) => asset.id),
      }));
      addAssets(assets);
    } catch (caught) {
      setLocationError(asApiError(caught).message);
    } finally {
      setLocationPending((current) => {
        const next = { ...current };
        delete next[location.id];
        return next;
      });
    }
  }

  function clearChosen() {
    onChange([]);
    setSelectedLocationIds([]);
    setLocationAssetIds({});
    setLocationPending({});
    setLocationError(null);
  }

  const locationBusy = Object.keys(locationPending).length > 0;

  return (
    <div className="grid gap-4">
      <h2 className="text-sm font-medium text-gray-800">Select assets</h2>
      <div className="grid grid-cols-3 rounded-lg bg-gray-100 p-1">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            onClick={() => {
              setMode(item.id);
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === item.id
                ? "bg-white text-gray-800 shadow-theme-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={`grid gap-3 ${mode === "location" ? "" : mode === "site" ? "" : "sm:grid-cols-2"}`}>
        <Select
          id="project-finder-site"
          label="Site"
          value={siteId}
          onChange={setSiteId}
        >
          <option value="">Choose a site</option>
          {sites.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        {mode === "asset" ? (
          <Select
            id="project-finder-location"
            label="Location"
            value={locationId}
            disabled={!siteId || flatLocationsRequest.loading}
            onChange={setLocationId}
          >
            <option value="">Whole site</option>
            {(flatLocationsRequest.data ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {locationOptionLabel(location)}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      {mode !== "location" && flatLocationsRequest.error ? (
        <p className="text-sm text-error-500" role="alert">
          {asApiError(flatLocationsRequest.error).message}
        </p>
      ) : null}
      {mode === "location" && treeLocationsRequest.error ? (
        <p className="text-sm text-error-500" role="alert">
          {asApiError(treeLocationsRequest.error).message}
        </p>
      ) : null}
      {locationError ? (
        <p className="text-sm text-error-500" role="alert">
          {locationError}
        </p>
      ) : null}
      {assetsRequest.error ? (
        <p className="text-sm text-error-500" role="alert">
          {asApiError(assetsRequest.error).message}
        </p>
      ) : null}

      {mode === "location" ? (
        !siteId ? (
          <p className="text-sm text-gray-500">Choose a site to browse locations.</p>
        ) : treeLocationsRequest.loading && !treeLocationsRequest.data ? (
          <p className="text-sm text-gray-500">Loading locations…</p>
        ) : (
          <LocationPickTree
            locations={treeLocations}
            selectedIds={selectedLocationIds}
            pendingIds={locationPending}
            disabled={false}
            onToggle={(location, selected) => {
              void toggleLocation(location, selected);
            }}
          />
        )
      ) : null}

      {mode !== "location" && assetsRequest.loading ? (
        <p className="text-sm text-gray-500">Loading assets…</p>
      ) : null}
      {mode !== "location" && assetsRequest.data && !assetsRequest.error ? (
        assetsRequest.data.length === 0 ? (
          <p className="text-sm text-gray-500">No assets yet.</p>
        ) : mode === "asset" ? (
          <ul className="grid gap-3">
            {assetsRequest.data.map((asset) => {
              const selected = chosen.some((item) => item.id === asset.id);

              return (
                <li key={asset.id}>
                  <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand-500"
                      checked={selected}
                      onChange={(event) => {
                        toggleAsset(asset, event.target.checked);
                      }}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">
                        {assetTitle(asset)}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {assetSubtitle(asset, site?.name ?? "", clientName)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-gray-500">
              {assetsRequest.data.length.toLocaleString()} asset
              {assetsRequest.data.length === 1 ? "" : "s"} at this site.
            </p>
            <button
              type="button"
              className="inline-flex w-fit items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              onClick={() => {
                addAssets(assetsRequest.data ?? []);
              }}
            >
              Add assets
            </button>
          </div>
        )
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-gray-800">Selected assets</h3>
          <p className="mt-1 text-sm text-gray-500">
            {chosen.length === 0
              ? "No assets selected."
              : `${chosen.length.toLocaleString()} asset${chosen.length === 1 ? "" : "s"} selected.`}
            {mode === "location" && selectedLocationIds.length > 0
              ? ` From ${selectedLocationIds.length.toLocaleString()} location${
                  selectedLocationIds.length === 1 ? "" : "s"
                }.`
              : null}
            {locationBusy ? " Updating…" : null}
          </p>
        </div>
        {chosen.length > 0 ? (
          <button
            type="button"
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
            onClick={clearChosen}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LocationPickTree({
  locations,
  selectedIds,
  pendingIds,
  disabled,
  onToggle,
}: {
  locations: Location[];
  selectedIds: string[];
  pendingIds: Record<string, boolean>;
  disabled?: boolean;
  onToggle: (location: Location, selected: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const children = buildLocationTree(locations);
  const searching = query.trim().length > 0;
  const selected = new Set(selectedIds);
  const rows = searching
    ? filterLocationTree(locations, query)
    : visibleRows(locations, children, expanded);

  if (locations.length === 0) {
    return <p className="text-sm text-gray-500">No locations yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="max-w-md">
        <TextField
          id="project-finder-location-search"
          label="Search locations"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No locations match.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => {
              const hasChildren = (children.get(row.id)?.length ?? 0) > 0;
              const isExpanded = Boolean(expanded[row.id]);
              const isSelected = selected.has(row.id);
              const isPending = Boolean(pendingIds[row.id]);

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
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-brand-500"
                        checked={isSelected}
                        disabled={disabled || isPending}
                        onChange={(event) => {
                          onToggle(row, event.target.checked);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-800">
                          {locationLabel(row)}
                          {isPending ? (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              Loading…
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone="light">{locationTypeLabel(row.locationType)}</Badge>
                          {row.locationCode ? (
                            <span className="text-xs text-gray-500">{row.locationCode}</span>
                          ) : null}
                          <Badge tone={row.status === "active" ? "success" : "light"}>
                            {locationStatusLabel(row.status)}
                          </Badge>
                        </span>
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-sm text-gray-500">
        Select one or more locations to include their assets. Child locations are
        included automatically.
      </p>
    </div>
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

function Select({
  id,
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={inputClassName}
      >
        {children}
      </select>
    </div>
  );
}

function assetPath(mode: FinderMode, siteId: string, locationId: string): string | null {
  if (!siteId) {
    return null;
  }

  if (mode === "location") {
    return null;
  }

  if (mode === "asset" && locationId) {
    return `/api/locations/${locationId}/assets`;
  }

  return `/api/sites/${siteId}/assets`;
}

function assetTitle(asset: FinderAsset): string {
  return asset.assetName ? `${asset.tag} - ${asset.assetName}` : asset.tag;
}

function assetSubtitle(asset: FinderAsset, siteName: string, clientName: string): string {
  const place = asset.location.name ?? asset.location.locationCode ?? siteName;
  return `${place} - ${clientName}`;
}
