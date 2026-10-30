"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AssetTable } from "@/components/assets/asset-table";
import { Badge, primaryButtonClassName, secondaryButtonClassName } from "@/components/form-controls";
import { SitePlanCanvas } from "@/components/site-plans/site-plan-canvas";
import { asApiError, useApi } from "@/lib/api-client";
import { locationLabel, locationTypeLabel, type Location } from "@/lib/locations";
import { parseAssetList, type AssetList } from "@/lib/sites";
import {
  featuresFromPlan,
  parseSitePlanBody,
  parseSitePlanList,
  planFeatureLabel,
  type LocalPlanFeature,
} from "@/lib/site-plans";

export function LocationSitePlanSection({
  floorId,
  childLocations,
  canEdit,
}: {
  floorId: string;
  childLocations: Location[];
  canEdit: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const listRequest = useApi("/api/site-plans", parseSitePlanList);
  const listItem =
    listRequest.data?.sitePlans.find((plan) => plan.location.id === floorId) ??
    null;
  const detailRequest = useApi(
    listItem ? `/api/site-plans/${listItem.id}?r=${revision}` : null,
    parseSitePlanBody,
  );
  const plan = detailRequest.data;
  const features = plan ? featuresFromPlan(plan) : [];
  const rooms = childLocations.filter(
    (child) => child.locationType === "room" || child.locationType === "area",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  function selectFeature(feature: LocalPlanFeature) {
    setSelectedKey(feature.key);
    setSelectedLocationId(feature.locationId);
    setSelectedLabel(planFeatureLabel(feature));
  }

  function selectRoom(room: Location) {
    setSelectedKey(null);
    setSelectedLocationId(room.id);
    setSelectedLabel(locationLabel(room));
  }

  const listLoading = listRequest.loading && !listRequest.data;
  const detailLoading = Boolean(listItem) && detailRequest.loading && !plan;
  const listError = listRequest.error;
  const detailError =
    detailRequest.error && detailRequest.error.status !== 404
      ? detailRequest.error
      : null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">Plan</h2>
          <Badge tone="info">Experiment</Badge>
        </div>
        {plan ? (
          <Link
            href={`/site-plans/${plan.id}`}
            className={secondaryButtonClassName}
          >
            Open site plan
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex min-w-0 flex-col gap-4">
        {listLoading || detailLoading ? (
          <p className="text-sm text-muted">Loading plan…</p>
        ) : null}

        {listError ? (
          <p className="text-sm leading-6 text-ink" role="alert">
            {asApiError(listError).message}
          </p>
        ) : null}

        {detailError ? (
          <p className="text-sm leading-6 text-ink" role="alert">
            {asApiError(detailError).message}
          </p>
        ) : null}

        {!listLoading && !listError && !listItem ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6">
            <p className="text-sm text-gray-700">No site plan for this floor yet.</p>
            {canEdit ? (
              <Link
                href="/site-plans/new"
                className={`${primaryButtonClassName} mt-4 inline-flex`}
              >
                New site plan
              </Link>
            ) : null}
          </div>
        ) : null}

        {plan ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
            <SitePlanCanvas
              key={`${plan.id}-${plan.updatedAt}-${revision}`}
              url={plan.url}
              contentType={plan.contentType}
              features={features}
              canDraw={false}
              selectedKey={selectedKey}
              draftRect={null}
              onDraftChange={() => {}}
              onDraftComplete={() => {}}
              onSelectFeature={selectFeature}
              onUrlExpired={() => {
                setRevision((value) => value + 1);
              }}
            />
            <div className="flex min-w-0 flex-col gap-4">
              {features.length === 0 ? (
                <RoomFallbackList
                  rooms={rooms}
                  selectedLocationId={selectedLocationId}
                  onSelect={selectRoom}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  Click a room on the plan to list its assets.
                </p>
              )}
              {selectedLocationId ? (
                <SelectedRoomAssets
                  locationId={selectedLocationId}
                  title={selectedLabel ?? "Room"}
                  onClear={() => {
                    setSelectedKey(null);
                    setSelectedLocationId(null);
                    setSelectedLabel(null);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RoomFallbackList({
  rooms,
  selectedLocationId,
  onSelect,
}: {
  rooms: Location[];
  selectedLocationId: string | null;
  onSelect: (room: Location) => void;
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No room overlays yet. Add child rooms to pick assets from a list.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-500">
        No room overlays yet. Pick a child room or area:
      </p>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {rooms.map((room) => {
          const selected = room.id === selectedLocationId;

          return (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(room);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${
                  selected ? "bg-brand-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="text-sm font-medium text-gray-800">
                  {locationLabel(room)}
                </span>
                <Badge tone="light">{locationTypeLabel(room.locationType)}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SelectedRoomAssets({
  locationId,
  title,
  onClear,
}: {
  locationId: string;
  title: string;
  onClear: () => void;
}) {
  const headingId = useId();
  const assetsRequest = useApi(
    `/api/locations/${locationId}/assets`,
    parseAssetList,
  );
  const missing = assetsRequest.error?.status === 404;
  const assets: AssetList =
    missing || (!assetsRequest.loading && !assetsRequest.data)
      ? { assetCount: 0, assets: [] }
      : (assetsRequest.data ?? { assetCount: 0, assets: [] });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold text-gray-800">
          {title}
        </h3>
        <button
          type="button"
          className="text-xs font-medium text-gray-500 hover:text-gray-700"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div className="mt-3" aria-labelledby={headingId}>
        {assetsRequest.loading && !assetsRequest.data ? (
          <p className="text-sm text-muted">Loading assets…</p>
        ) : assetsRequest.error && !missing ? (
          <p className="text-sm text-ink" role="alert">
            {assetsRequest.error.message}
          </p>
        ) : assets.assets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets in this room.</p>
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <AssetTable assets={assets.assets} />
            <p className="mt-2 text-xs text-gray-500">
              <Link
                href={`/locations/${locationId}`}
                className="text-brand-500 hover:underline"
              >
                Open room
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
