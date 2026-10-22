"use client";

import { Suspense, useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { assetStatusLabel } from "@/components/assets/asset-table";
import { MaintenanceHistoryPanel } from "@/components/assets/maintenance-history";
import { MaintenanceSchedulePanel } from "@/components/assets/maintenance-schedules";
import { ParentAssetPicker } from "@/components/assets/parent-asset-picker";
import { WorkOrderPanel } from "@/components/work-orders/work-order-panel";
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
import { Nrm3ClassificationPicker } from "@/components/nrm3-classifications/nrm3-classification-picker";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseAssetTypeList, type AssetType } from "@/lib/asset-types";
import {
  parseMaintenanceHistoryList,
  type MaintenanceHistoryList,
} from "@/lib/maintenance-history";
import {
  parseMaintenanceScheduleList,
  type MaintenanceScheduleList,
} from "@/lib/maintenance-schedules";
import {
  nrm3Label,
  parseNrm3ClassificationList,
  type Nrm3Classification,
} from "@/lib/nrm3-classifications";
import { parseWorkOrderList, type WorkOrderList } from "@/lib/work-orders";
import {
  ASSET_TYPES_VIEW,
  CLIENTS_EDIT,
  CLIENTS_VIEW,
  MAINTENANCE_TYPES_VIEW,
  NRM3_CLASSIFICATIONS_VIEW,
  hasPermission,
} from "@/lib/session";
import {
  ASSET_STATUSES,
  parentAssetLabel,
  parseAssetBody,
  parseAssetList,
  parseSiteSummary,
  type Asset,
  type AssetStatus,
} from "@/lib/sites";

type RecordTab = "schedules" | "orders" | "history";

export function AssetDetail({ id }: { id: string }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading asset…</p>}>
      <AssetDetailContent id={id} />
    </Suspense>
  );
}

function AssetDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scheduleParam = searchParams.get("schedule");
  const historyParam = searchParams.get("history");
  const scheduleId = scheduleParam && scheduleParam.length > 0 ? scheduleParam : null;
  const historyId = historyParam && historyParam.length > 0 ? historyParam : null;
  const linkKey = historyId
    ? `history:${historyId}`
    : scheduleId
      ? `schedule:${scheduleId}`
      : null;
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canPickTypes = hasPermission(user, ASSET_TYPES_VIEW);
  const canPickNrm3 = hasPermission(user, NRM3_CLASSIFICATIONS_VIEW);
  const canPickMaintenanceTypes = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const tablistId = useId();
  const request = useApi(canView ? `/api/assets/${id}` : null, parseAssetBody);
  const siteRequest = useApi(
    canView && request.data ? `/api/sites/${request.data.location.siteId}` : null,
    parseSiteSummary,
  );
  const typesRequest = useApi(
    canView && canEdit && canPickTypes ? "/api/asset-types" : null,
    parseAssetTypeList,
  );
  const nrm3Request = useApi(
    canView && canEdit && canPickNrm3 ? "/api/nrm3-classifications" : null,
    parseNrm3ClassificationList,
  );
  const parentsRequest = useApi(
    canView && canEdit && request.data
      ? `/api/sites/${request.data.location.siteId}/assets`
      : null,
    parseAssetList,
  );
  const schedulesRequest = useApi(
    canView && request.data ? `/api/assets/${request.data.id}/maintenance-schedules` : null,
    parseMaintenanceScheduleList,
  );
  const ordersRequest = useApi(
    canView && request.data ? `/api/assets/${request.data.id}/work-orders` : null,
    parseWorkOrderList,
  );
  const historyRequest = useApi(
    canView && request.data ? `/api/assets/${request.data.id}/maintenance-history` : null,
    parseMaintenanceHistoryList,
  );
  const [saved, setSaved] = useState<Asset | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const [savedSchedules, setSavedSchedules] = useState<MaintenanceScheduleList | null>(null);
  const [schedulesFor, setSchedulesFor] = useState(id);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savedOrders, setSavedOrders] = useState<WorkOrderList | null>(null);
  const [ordersFor, setOrdersFor] = useState(id);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savedHistory, setSavedHistory] = useState<MaintenanceHistoryList | null>(null);
  const [historyFor, setHistoryFor] = useState(id);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recordTab, setRecordTab] = useState<RecordTab>("schedules");
  const [recordTabFor, setRecordTabFor] = useState(id);
  const [seenLink, setSeenLink] = useState<string | null>(null);
  const missing = request.error?.status === 404;
  const schedulesMissing = schedulesRequest.error?.status === 404;
  const ordersMissing = ordersRequest.error?.status === 404;
  const historyMissing = historyRequest.error?.status === 404;
  const assetChanged =
    savedFor !== id ||
    schedulesFor !== id ||
    ordersFor !== id ||
    historyFor !== id ||
    recordTabFor !== id;

  if (assetChanged) {
    setSavedFor(id);
    setSchedulesFor(id);
    setOrdersFor(id);
    setHistoryFor(id);
    setRecordTabFor(id);
    setSaved(null);
    setSavedSchedules(null);
    setSavedOrders(null);
    setSavedHistory(null);
    setScheduleError(null);
    setOrderError(null);
    setHistoryError(null);
    setSeenLink(linkKey);
    setRecordTab(historyId ? "history" : "schedules");
  } else if (linkKey !== seenLink) {
    setSeenLink(linkKey);
    if (historyId) {
      setRecordTab("history");
    } else if (scheduleId) {
      setRecordTab("schedules");
    }
  }

  useEffect(() => {
    if (missing || schedulesMissing || ordersMissing || historyMissing) {
      router.replace("/sites");
    }
  }, [missing, schedulesMissing, ordersMissing, historyMissing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing || schedulesMissing || ordersMissing || historyMissing) {
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
  const scheduleList = savedSchedules ?? schedulesRequest.data;
  const orderList = savedOrders ?? ordersRequest.data;
  const historyList = savedHistory ?? historyRequest.data;

  function clearQuery(name: "schedule" | "history") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(name);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

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

      if (apiError.status === 404 && apiError.message === "Asset not found.") {
        router.replace("/sites");
      }

      throw apiError;
    }
  }

  async function reloadSchedules() {
    try {
      setSavedSchedules(
        parseMaintenanceScheduleList(
          await apiRequest(`/api/assets/${loaded.id}/maintenance-schedules`),
        ),
      );
      setScheduleError(null);
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/sites");
        return;
      }

      setScheduleError(apiError.message);
    }
  }

  async function reloadWorkOrders() {
    try {
      setSavedOrders(
        parseWorkOrderList(await apiRequest(`/api/assets/${loaded.id}/work-orders`)),
      );
      setOrderError(null);
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/sites");
        return;
      }

      setOrderError(apiError.message);
    }
  }

  async function reloadHistory() {
    try {
      setSavedHistory(
        parseMaintenanceHistoryList(
          await apiRequest(`/api/assets/${loaded.id}/maintenance-history`),
        ),
      );
      setHistoryError(null);
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/sites");
        return;
      }

      setHistoryError(apiError.message);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
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
            { label: asset.assetName ?? asset.tag },
          ]}
        />
        <p className="mt-6 text-sm text-gray-500">Asset</p>
        <InlineTitle
          value={asset.assetName ?? ""}
          display={asset.assetName ?? asset.tag}
          field="assetName"
          maxLength={255}
          editable={canEdit}
          onSave={async (assetName) => {
            await saveAsset({ assetName: assetName || null });
          }}
        />
        <PropertyGrid columns={3}>
          <InlineText
            label="Tag"
            field="tag"
            value={asset.tag}
            editable={canEdit}
            maxLength={100}
            onSave={async (tag) => {
              if (!tag) {
                throw new ApiRequestError(400, "Invalid request", {
                  tag: ["Enter a tag."],
                });
              }

              await saveAsset({ tag });
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
          <Nrm3Field
            asset={asset}
            editable={canEdit && canPickNrm3}
            items={nrm3Request.data ?? []}
            loading={nrm3Request.loading}
            itemsError={nrm3Request.error?.message ?? null}
            onSave={async (nextCode) => {
              await saveAsset({ nrm3Code: nextCode || null });
            }}
          />
          <ParentAssetField
            asset={asset}
            editable={canEdit}
            assets={(parentsRequest.data?.assets ?? []).filter(
              (candidate) => candidate.id !== asset.id,
            )}
            loading={parentsRequest.loading}
            assetsError={parentsRequest.error?.message ?? null}
            onSave={async (parentAssetId) => {
              await saveAsset({ parentAssetId: parentAssetId || null });
            }}
          />
          <InlineText
            label="Manufacturer"
            field="manufacturer"
            value={asset.manufacturer ?? ""}
            editable={canEdit}
            onSave={async (manufacturer) => {
              await saveAsset({ manufacturer: manufacturer || null });
            }}
          />
          <InlineText
            label="Model"
            field="model"
            value={asset.model ?? ""}
            editable={canEdit}
            maxLength={150}
            onSave={async (model) => {
              await saveAsset({ model: model || null });
            }}
          />
          <InlineText
            label="Serial number"
            field="serialNumber"
            value={asset.serialNumber ?? ""}
            editable={canEdit}
            maxLength={150}
            onSave={async (serialNumber) => {
              await saveAsset({ serialNumber: serialNumber || null });
            }}
          />
          <InlineText
            label="Year of manufacture"
            field="yearOfManufacture"
            type="number"
            value={asset.yearOfManufacture == null ? "" : String(asset.yearOfManufacture)}
            editable={canEdit}
            onSave={async (raw) => {
              if (!raw) {
                await saveAsset({ yearOfManufacture: null });
                return;
              }

              if (!/^\d{4}$/.test(raw)) {
                throw new ApiRequestError(400, "Invalid request", {
                  yearOfManufacture: ["Enter a year between 1000 and 9999."],
                });
              }

              const year = Number(raw);

              if (year < 1000 || year > 9999) {
                throw new ApiRequestError(400, "Invalid request", {
                  yearOfManufacture: ["Enter a year between 1000 and 9999."],
                });
              }

              await saveAsset({ yearOfManufacture: year });
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
        </PropertyGrid>
      </section>
      <section>
        <div
          role="tablist"
          aria-label="Asset records"
          className="flex flex-wrap gap-6 border-b border-gray-200"
        >
          {(
            [
              ["schedules", "Maintenance schedules", scheduleList?.maintenanceScheduleCount],
              ["orders", "Work orders", orderList?.workOrderCount],
              ["history", "Maintenance history", historyList?.maintenanceHistoryCount],
            ] as const
          ).map(([itemId, label, count]) => {
            const selected = recordTab === itemId;

            return (
              <button
                key={itemId}
                type="button"
                role="tab"
                id={`${tablistId}-${itemId}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-${itemId}-panel`}
                onClick={() => {
                  setRecordTab(itemId);
                }}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
                  selected
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {count == null ? null : (
                  <span className="ml-2 font-medium text-gray-500">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`${tablistId}-schedules-panel`}
          aria-labelledby={`${tablistId}-schedules`}
          hidden={recordTab !== "schedules"}
          className="mt-6"
        >
          <MaintenanceSchedulePanel
            assetId={asset.id}
            schedules={scheduleList}
            loading={schedulesRequest.loading && !scheduleList}
            error={
              scheduleError ?? (scheduleList ? null : (schedulesRequest.error?.message ?? null))
            }
            canEdit={canEdit}
            canPickTypes={canPickMaintenanceTypes}
            requestedScheduleId={historyId ? null : scheduleId}
            onRequestedScheduleClose={
              scheduleId && !historyId
                ? () => {
                    clearQuery("schedule");
                  }
                : undefined
            }
            onReload={reloadSchedules}
            onAssetMissing={() => {
              router.replace("/sites");
            }}
          />
        </div>
        <div
          role="tabpanel"
          id={`${tablistId}-orders-panel`}
          aria-labelledby={`${tablistId}-orders`}
          hidden={recordTab !== "orders"}
          className="mt-6"
        >
          <WorkOrderPanel
            assetId={asset.id}
            assetLabel={asset.assetName ?? asset.tag}
            orders={orderList}
            loading={ordersRequest.loading && !orderList}
            error={orderError ?? (orderList ? null : (ordersRequest.error?.message ?? null))}
            canCreate={canPickMaintenanceTypes}
            canEdit={canPickMaintenanceTypes}
            onReload={reloadWorkOrders}
            onHistoryChange={reloadHistory}
          />
        </div>
        <div
          role="tabpanel"
          id={`${tablistId}-history-panel`}
          aria-labelledby={`${tablistId}-history`}
          hidden={recordTab !== "history"}
          className="mt-6"
        >
          <MaintenanceHistoryPanel
            assetId={asset.id}
            records={historyList}
            loading={historyRequest.loading && !historyList}
            error={
              historyError ?? (historyList ? null : (historyRequest.error?.message ?? null))
            }
            workOrders={orderList}
            canEdit={canEdit}
            canPickTypes={canPickMaintenanceTypes}
            requestedHistoryId={historyId}
            onRequestedHistoryClose={
              historyId
                ? () => {
                    clearQuery("history");
                  }
                : undefined
            }
            onReload={reloadHistory}
            onAssetMissing={() => {
              router.replace("/sites");
            }}
          />
        </div>
      </section>
    </div>
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

function Nrm3Field({
  asset,
  editable,
  items,
  loading,
  itemsError,
  onSave,
}: {
  asset: Asset;
  editable: boolean;
  items: Nrm3Classification[];
  loading: boolean;
  itemsError: string | null;
  onSave: (nrm3Code: string) => Promise<void>;
}) {
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const currentCode = asset.nrm3Code ?? "";

  return (
    <Property label="NRM3">
      {editable ? (
        <>
          <Nrm3ClassificationPicker
            id={`asset-${asset.id}-nrm3`}
            items={items}
            value={currentCode}
            disabled={pending}
            loading={loading}
            clearLabel="No NRM3 classification"
            onChange={(code) => {
              if (code === currentCode || pending) {
                return;
              }

              setPending(true);
              setError(null);
              void onSave(code)
                .catch((caught) => {
                  setError(asApiError(caught));
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          />
          {itemsError ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {itemsError}
            </p>
          ) : null}
          {error ? (
            <>
              <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
              <FieldMessages messages={error.fieldErrors.nrm3Code} />
            </>
          ) : null}
        </>
      ) : (
        <span>{nrm3Label(asset.nrm3Classification)}</span>
      )}
    </Property>
  );
}

function ParentAssetField({
  asset,
  editable,
  assets,
  loading,
  assetsError,
  onSave,
}: {
  asset: Asset;
  editable: boolean;
  assets: Asset[];
  loading: boolean;
  assetsError: string | null;
  onSave: (parentAssetId: string) => Promise<void>;
}) {
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const currentId = asset.parentAssetId ?? "";

  return (
    <Property label="Parent asset">
      {editable ? (
        <>
          <ParentAssetPicker
            id={`asset-${asset.id}-parent`}
            assets={assets}
            value={currentId}
            disabled={pending}
            loading={loading}
            clearLabel="No parent asset"
            onChange={(parentAssetId) => {
              if (parentAssetId === currentId || pending) {
                return;
              }

              setPending(true);
              setError(null);
              void onSave(parentAssetId)
                .catch((caught) => {
                  setError(asApiError(caught));
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          />
          {assetsError ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {assetsError}
            </p>
          ) : null}
          {error ? (
            <>
              <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
              <FieldMessages messages={error.fieldErrors.parentAssetId} />
            </>
          ) : null}
        </>
      ) : (
        <span>{parentAssetLabel(asset.parentAsset)}</span>
      )}
    </Property>
  );
}
