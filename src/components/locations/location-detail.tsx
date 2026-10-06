"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetTable } from "@/components/assets/asset-table";
import { Forbidden } from "@/components/forbidden";
import { secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import {
  includeAsset,
  parseAssetList,
  parseLocationBody,
  type AssetList,
} from "@/lib/sites";

export function LocationDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const locationRequest = useApi(
    canView ? `/api/locations/${id}` : null,
    parseLocationBody,
  );
  const assetsRequest = useApi(
    canView ? `/api/locations/${id}/assets` : null,
    parseAssetList,
  );
  const [savedAssets, setSavedAssets] = useState<AssetList | null>(null);
  const [assetsForLocation, setAssetsForLocation] = useState(id);
  const [adding, setAdding] = useState(false);
  const missing = locationRequest.error?.status === 404;
  const assetsMissing = assetsRequest.error?.status === 404;
  const forbidden = locationRequest.error?.status === 403 ? locationRequest.error : null;
  const error = locationRequest.error;

  useEffect(() => {
    if (missing) {
      router.replace("/sites");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (locationRequest.loading || (!assetsMissing && assetsRequest.loading)) {
    return <p className="text-sm text-muted">Loading location…</p>;
  }

  if (forbidden) {
    return <Forbidden message={forbidden.message} />;
  }

  if (error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(error).message}
      </p>
    );
  }

  if (assetsRequest.error && !assetsMissing) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {assetsRequest.error.message}
      </p>
    );
  }

  const location = locationRequest.data;
  const assets =
    assetsForLocation === id && savedAssets
      ? savedAssets
      : assetsMissing
        ? { assetCount: 0, assets: [] }
        : assetsRequest.data;

  if (assetsForLocation !== id) {
    setAssetsForLocation(id);
    setSavedAssets(null);
    setAdding(false);
  }

  if (!location || !assets) {
    return null;
  }

  const loaded = location;
  const loadedAssets = assets;

  async function created(asset: AssetList["assets"][number]) {
    setAdding(false);

    try {
      const list = parseAssetList(await apiRequest(`/api/locations/${loaded.id}/assets`));
      setSavedAssets(includeAsset(list, asset));
    } catch {
      setSavedAssets(includeAsset(loadedAssets, asset));
    }
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <Link
          href={`/sites/${location.siteId}`}
          className="text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          Site
        </Link>
        <p className="mt-6 text-sm text-gray-500">Location</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-800">
          {location.name ?? location.locationCode ?? "Location"}
        </h1>
        <p className="mt-3 text-sm text-muted">Location code</p>
        <p className="mt-1 text-sm font-medium">{location.locationCode ?? "—"}</p>
      </section>
      <section>
        {canEdit && !adding ? (
          <div className="flex justify-end">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setAdding(true);
              }}
            >
              Add asset
            </button>
          </div>
        ) : null}
        {assets.assets.length === 0 && !adding ? (
          <p className="text-sm text-gray-500">No assets yet.</p>
        ) : assets.assets.length > 0 ? (
          <AssetTable assets={assets.assets} includeLocation={false} />
        ) : null}
        {adding ? (
          <div className="mt-4 rounded-card bg-surface p-5 shadow-card">
            <AssetForm
              locationId={location.id}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={(asset) => {
                void created(asset);
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
