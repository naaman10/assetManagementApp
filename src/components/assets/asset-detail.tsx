"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { assetStatusLabel } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import {
  FieldMessages,
  FormBanner,
  bannerMessage,
} from "@/components/form-controls";
import {
  InlineSelect,
  InlineText,
  InlineTitle,
  Property,
  PropertyGrid,
} from "@/components/inline-field";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseAssetTypeList, type AssetType } from "@/lib/asset-types";
import { ASSET_TYPES_VIEW, CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import {
  ASSET_STATUSES,
  parseAssetBody,
  parseSiteSummary,
  type Asset,
  type AssetStatus,
} from "@/lib/sites";

export function AssetDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canPickTypes = hasPermission(user, ASSET_TYPES_VIEW);
  const request = useApi(canView ? `/api/assets/${id}` : null, parseAssetBody);
  const siteRequest = useApi(
    canView && request.data ? `/api/sites/${request.data.location.siteId}` : null,
    parseSiteSummary,
  );
  const typesRequest = useApi(
    canView && canEdit && canPickTypes ? "/api/asset-types" : null,
    parseAssetTypeList,
  );
  const [saved, setSaved] = useState<Asset | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const missing = request.error?.status === 404;

  if (savedFor !== id) {
    setSavedFor(id);
    setSaved(null);
  }

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

  if (request.loading || siteRequest.loading) {
    return <p className="text-sm text-muted">Loading asset…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
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

  const asset = saved?.id === request.data?.id ? saved : request.data;
  const site = siteRequest.data;

  if (!asset || !site) {
    return null;
  }

  const loaded = asset;

  async function saveAsset(patch: Record<string, unknown>) {
    try {
      setSaved(
        parseAssetBody(
          await apiRequest(`/api/assets/${loaded.id}`, {
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

  return (
    <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
      <Breadcrumbs
        current
        items={[
          { label: asset.client.name, href: `/clients/${asset.client.id}` },
          { label: site.name, href: `/sites/${site.id}` },
          {
            label: asset.location.name ?? asset.location.locationCode ?? "Location",
            href: `/locations/${asset.location.id}`,
          },
          { label: asset.assetName ?? asset.assetRef },
        ]}
      />
      <p className="mt-6 text-sm text-gray-500">Asset</p>
      <InlineTitle
        value={asset.assetName ?? ""}
        display={asset.assetName ?? asset.assetRef}
        field="assetName"
        maxLength={255}
        editable={canEdit}
        onSave={async (assetName) => {
          await saveAsset({ assetName: assetName || null });
        }}
      />
      <PropertyGrid>
        <InlineText
          label="Reference"
          field="assetRef"
          value={asset.assetRef}
          editable={canEdit}
          maxLength={200}
          onSave={async (assetRef) => {
            if (!assetRef) {
              throw new ApiRequestError(400, "Invalid request", {
                assetRef: ["Enter a reference."],
              });
            }

            await saveAsset({ assetRef });
          }}
        />
        <AssetTypeField
          asset={asset}
          editable={canEdit && canPickTypes}
          types={typesRequest.data ?? []}
          loading={typesRequest.loading}
          typesError={typesRequest.error?.message ?? null}
          onSave={async (assetTypeId) => {
            await saveAsset({ assetTypeId });
          }}
        />
        <InlineText
          label="Quantity"
          field="quantity"
          type="number"
          value={asset.quantity == null ? "" : String(asset.quantity)}
          editable={canEdit}
          onSave={async (raw) => {
            if (!raw) {
              await saveAsset({ quantity: null });
              return;
            }

            const quantity = Number(raw);

            if (!Number.isFinite(quantity)) {
              throw new ApiRequestError(400, "Invalid request", {
                quantity: ["Enter a quantity."],
              });
            }

            await saveAsset({ quantity });
          }}
        />
        <InlineText
          label="Unit"
          field="unitOfMeasure"
          value={asset.unitOfMeasure ?? ""}
          editable={canEdit}
          maxLength={40}
          onSave={async (unitOfMeasure) => {
            await saveAsset({ unitOfMeasure: unitOfMeasure || null });
          }}
        />
        <InlineSelect
          label="Status"
          field="status"
          value={asset.status}
          editable={canEdit}
          options={ASSET_STATUSES.map((status) => ({
            value: status,
            label: assetStatusLabel(status),
          }))}
          onSave={async (status) => {
            await saveAsset({ status: status as AssetStatus });
          }}
        />
      </PropertyGrid>
    </section>
  );
}

function AssetTypeField({
  asset,
  editable,
  types,
  loading,
  typesError,
  onSave,
}: {
  asset: Asset;
  editable: boolean;
  types: AssetType[];
  loading: boolean;
  typesError: string | null;
  onSave: (assetTypeId: string) => Promise<void>;
}) {
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const options = types.filter(
    (assetType) => assetType.isActive || assetType.id === asset.assetType.id,
  );

  return (
    <Property label="Type">
      {editable ? (
        <>
          <AssetTypePicker
            id={`asset-${asset.id}-type`}
            types={options}
            value={asset.assetType.id}
            disabled={pending}
            loading={loading}
            onChange={(assetTypeId) => {
              if (assetTypeId === asset.assetType.id || pending) {
                return;
              }

              setPending(true);
              setError(null);
              void onSave(assetTypeId)
                .catch((caught) => {
                  setError(asApiError(caught));
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          />
          {typesError ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {typesError}
            </p>
          ) : null}
          {error ? (
            <>
              <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
              <FieldMessages messages={error.fieldErrors.assetTypeId} />
            </>
          ) : null}
        </>
      ) : (
        <span>{asset.assetType.name}</span>
      )}
    </Property>
  );
}
