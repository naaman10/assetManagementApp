"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetTable } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import { secondaryButtonClassName } from "@/components/form-controls";
import { InlineText, InlineTitle, PropertyGrid } from "@/components/inline-field";
import { Modal } from "@/components/modal";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import {
  includeAsset,
  parseAssetList,
  parseLocationBody,
  parseSiteSummary,
  type AssetList,
  type SiteLocation,
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
  const siteRequest = useApi(
    canView && locationRequest.data
      ? `/api/sites/${locationRequest.data.siteId}`
      : null,
    parseSiteSummary,
  );
  const assetsRequest = useApi(
    canView ? `/api/locations/${id}/assets` : null,
    parseAssetList,
  );
  const [saved, setSaved] = useState<SiteLocation | null>(null);
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

  if (locationRequest.loading || siteRequest.loading || (!assetsMissing && assetsRequest.loading)) {
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

  if (siteRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {siteRequest.error.message}
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

  const location =
    saved?.id === locationRequest.data?.id ? saved : locationRequest.data;
  const site = siteRequest.data;
  const assets =
    assetsForLocation === id && savedAssets
      ? savedAssets
      : assetsMissing
        ? { assetCount: 0, assets: [] }
        : assetsRequest.data;

  if (assetsForLocation !== id) {
    setAssetsForLocation(id);
    setSaved(null);
    setSavedAssets(null);
    setAdding(false);
  }

  if (!location || !site || !assets) {
    return null;
  }

  const loaded = location;
  const loadedAssets = assets;

  async function saveLocation(patch: Record<string, string | null>) {
    try {
      setSaved(
        parseLocationBody(
          await apiRequest(`/api/locations/${loaded.id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ),
      );
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/sites");
      }

      throw apiError;
    }
  }

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
        {location.client ? (
          <Breadcrumbs
            current
            items={[
              { label: location.client.name, href: `/clients/${location.client.id}` },
              { label: site.name, href: `/sites/${site.id}` },
              { label: location.name ?? location.locationCode ?? "Location" },
            ]}
          />
        ) : (
          <Link
            href={`/sites/${location.siteId}`}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Site
          </Link>
        )}
        <p className="mt-6 text-sm text-gray-500">Location</p>
        <InlineTitle
          value={location.name ?? ""}
          display={location.name ?? location.locationCode ?? "Location"}
          editable={canEdit}
          onSave={async (name) => {
            if (!name && !location.locationCode) {
              throw new ApiRequestError(400, "Invalid request", {
                name: ["Enter a name or a location code."],
              });
            }

            await saveLocation({ name: name || null });
          }}
        />
        <PropertyGrid>
          <InlineText
            label="Location code"
            field="locationCode"
            value={location.locationCode ?? ""}
            editable={canEdit}
            maxLength={200}
            onSave={async (locationCode) => {
              if (!locationCode && !location.name) {
                throw new ApiRequestError(400, "Invalid request", {
                  locationCode: ["Enter a name or a location code."],
                });
              }

              await saveLocation({ locationCode: locationCode || null });
            }}
          />
        </PropertyGrid>
      </section>
      <section>
        {canEdit ? (
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
        {assets.assets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets yet.</p>
        ) : (
          <AssetTable assets={assets.assets} />
        )}
        {adding ? (
          <Modal
            title="Add asset"
            onClose={() => {
              setAdding(false);
            }}
          >
            <AssetForm
              locationId={location.id}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={(asset) => {
                void created(asset);
              }}
            />
          </Modal>
        ) : null}
      </section>
    </div>
  );
}
