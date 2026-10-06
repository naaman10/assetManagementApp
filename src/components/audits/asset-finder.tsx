"use client";

import { useState } from "react";
import { inputClassName } from "@/components/form-controls";
import { asApiError, useApi } from "@/lib/api-client";
import {
  locationOptionLabel,
  parseFinderAssets,
  parseFinderLocations,
  type FinderAsset,
  type NamedOption,
} from "@/lib/audits";

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
  onChange: (assets: FinderAsset[]) => void;
}) {
  const [mode, setMode] = useState<FinderMode>("asset");
  const [siteId, setSiteId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [selectionForSite, setSelectionForSite] = useState("");
  const locationsRequest = useApi(
    siteId ? `/api/sites/${siteId}/locations` : null,
    parseFinderLocations,
  );
  const assetsRequest = useApi(assetPath(mode, siteId, locationId), parseFinderAssets);
  const site = sites.find((item) => item.id === siteId) ?? null;

  if (siteId !== selectionForSite) {
    setSelectionForSite(siteId);
    setLocationId("");
  }

  function addAssets(incoming: FinderAsset[]) {
    const seen = new Set(chosen.map((asset) => asset.id));
    const next = [...chosen];

    for (const asset of incoming) {
      if (seen.has(asset.id)) {
        continue;
      }

      seen.add(asset.id);
      next.push(asset);
    }

    onChange(next);
  }

  function toggleAsset(asset: FinderAsset, selected: boolean) {
    if (selected) {
      addAssets([asset]);
      return;
    }

    onChange(chosen.filter((item) => item.id !== asset.id));
  }

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
      <div className={`grid gap-3 ${mode === "site" ? "" : "sm:grid-cols-2"}`}>
        <Select
          id="audit-finder-site"
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
        {mode === "site" ? null : (
          <Select
            id="audit-finder-location"
            label="Location"
            value={locationId}
            disabled={!siteId || locationsRequest.loading}
            onChange={setLocationId}
          >
            {mode === "asset" ? <option value="">Whole site</option> : null}
            {mode === "location" ? <option value="">Choose a location</option> : null}
            {(locationsRequest.data ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {locationOptionLabel(location)}
              </option>
            ))}
          </Select>
        )}
      </div>
      {locationsRequest.error ? (
        <p className="text-sm text-error-500" role="alert">
          {asApiError(locationsRequest.error).message}
        </p>
      ) : null}
      {assetsRequest.error ? (
        <p className="text-sm text-error-500" role="alert">
          {asApiError(assetsRequest.error).message}
        </p>
      ) : null}
      {assetsRequest.loading ? <p className="text-sm text-gray-500">Loading assets…</p> : null}
      {assetsRequest.data && !assetsRequest.error ? (
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
            <ul className="grid gap-3">
              {assetsRequest.data.map((asset) => (
                <li
                  key={asset.id}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <p className="text-sm font-medium text-gray-800">{assetTitle(asset)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {assetSubtitle(asset, site?.name ?? "", clientName)}
                  </p>
                </li>
              ))}
            </ul>
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
      <div>
        <h3 className="text-sm font-medium text-gray-800">Chosen assets</h3>
        {chosen.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No assets selected.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {chosen.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-gray-800">{asset.assetRef}</span>
                  <span className="mt-1 block text-sm text-gray-500">
                    {asset.assetName ?? "—"}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-500 hover:text-gray-800"
                  onClick={() => {
                    onChange(chosen.filter((item) => item.id !== asset.id));
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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
    return locationId ? `/api/locations/${locationId}/assets` : null;
  }

  if (mode === "asset" && locationId) {
    return `/api/locations/${locationId}/assets`;
  }

  return `/api/sites/${siteId}/assets`;
}

function assetTitle(asset: FinderAsset): string {
  return asset.assetName ? `${asset.assetRef} - ${asset.assetName}` : asset.assetRef;
}

function assetSubtitle(asset: FinderAsset, siteName: string, clientName: string): string {
  const place = asset.location.name ?? asset.location.locationCode ?? siteName;
  return `${place} - ${clientName}`;
}
