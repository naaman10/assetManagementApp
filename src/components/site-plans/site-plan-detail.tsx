"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetTable } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { InlineTitle } from "@/components/inline-field";
import { Modal } from "@/components/modal";
import { SitePlanCanvas } from "@/components/site-plans/site-plan-canvas";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  locationLabel,
  locationTypeLabel,
  parseLocationBody,
  parseLocationList,
  type Location,
} from "@/lib/locations";
import { parseAssetList, type AssetList } from "@/lib/sites";
import {
  MIN_PLAN_POLYGON_DIAGONAL,
  draftPolygonBBoxDiagonal,
  featuresFromPlan,
  featuresPutBody,
  locationDisplayName,
  parseSitePlanBody,
  planFeatureLabel,
  planFileProblem,
  pointsToPolygon,
  type DraftPolygon,
  type LocalPlanFeature,
  type SitePlan,
} from "@/lib/site-plans";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";

type PlanMode = "view" | "edit";

type AssignTarget =
  | { kind: "new"; geometry: LocalPlanFeature["geometry"] }
  | { kind: "reassign"; featureKey: string };

export function SitePlanDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const [revision, setRevision] = useState(0);
  const [urlRetryUsed, setUrlRetryUsed] = useState(false);
  const planPath = canView ? `/api/site-plans/${id}?r=${revision}` : null;
  const planRequest = useApi(planPath, parseSitePlanBody);
  const missing = planRequest.error?.status === 404;
  const forbidden = planRequest.error?.status === 403 ? planRequest.error : null;
  const [heldPlan, setHeldPlan] = useState<SitePlan | null>(null);
  const fetchedPlan = missing ? null : planRequest.data;
  const plan = heldPlan ?? fetchedPlan;

  const roomsRequest = useApi(
    canView && plan ? `/api/sites/${plan.site.id}/locations` : null,
    parseLocationList,
  );
  const [roomsOverride, setRoomsOverride] = useState<Location[] | null>(null);
  const allLocations = roomsOverride ?? roomsRequest.data?.locations ?? [];
  const rooms = allLocations.filter(
    (location) =>
      location.parentLocationId === plan?.locationId &&
      (location.locationType === "room" || location.locationType === "area"),
  );

  const [mode, setMode] = useState<PlanMode>("view");
  const [features, setFeatures] = useState<LocalPlanFeature[]>([]);
  const [syncedPlanKey, setSyncedPlanKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draftPolygon, setDraftPolygon] = useState<DraftPolygon | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [redrawKey, setRedrawKey] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignedLocationIds = new Set(features.map((feature) => feature.locationId));
  const unmappedRooms = rooms.filter((room) => !assignedLocationIds.has(room.id));
  const selectedFeature =
    selectedKey == null
      ? null
      : (features.find((feature) => feature.key === selectedKey) ?? null);

  const planSyncKey = plan
    ? `${plan.id}:${plan.updatedAt}:${plan.url}`
    : missing
      ? `missing:${revision}`
      : null;

  if (
    heldPlan &&
    fetchedPlan &&
    heldPlan.id === fetchedPlan.id &&
    heldPlan.updatedAt === fetchedPlan.updatedAt
  ) {
    setHeldPlan(null);
  }

  if (planSyncKey !== syncedPlanKey) {
    setSyncedPlanKey(planSyncKey);

    if (plan && !dirty) {
      setFeatures(featuresFromPlan(plan));
      setSelectedKey(null);
      setDraftPolygon(null);
      setAssignTarget(null);
      setRedrawKey(null);
    }

    if (!plan) {
      setFeatures([]);
      setDirty(false);
      setMode("view");
      setSelectedKey(null);
      setDraftPolygon(null);
      setAssignTarget(null);
      setRedrawKey(null);
    }
  }

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return (
      <p className="text-sm text-gray-500">
        Site plan not found.{" "}
        <Link href="/site-plans" className="text-brand-500 hover:underline">
          Back to site plans
        </Link>
      </p>
    );
  }

  if (planRequest.loading && !plan) {
    return <p className="text-sm text-muted">Loading site plan…</p>;
  }

  if (forbidden) {
    return <Forbidden message={forbidden.message} />;
  }

  if (planRequest.error && !plan) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(planRequest.error).message}
      </p>
    );
  }

  if (!plan) {
    return null;
  }

  const loaded = plan;

  function refreshPlan() {
    // Only retry a signed URL once. Remounting the canvas resets its local
    // retry flag, which previously caused an infinite loading loop.
    if (urlRetryUsed) {
      return;
    }

    setUrlRetryUsed(true);
    setHeldPlan(null);
    setRevision((value) => value + 1);
  }

  function applyPlan(next: SitePlan) {
    setHeldPlan(next);
    setFeatures(featuresFromPlan(next));
    setDirty(false);
    setDraftPolygon(null);
    setAssignTarget(null);
    setRedrawKey(null);
  }

  function selectRoom(locationId: string, label: string) {
    setSelectedLocationId(locationId);
    setSelectedLabel(label);
  }

  function selectFeature(feature: LocalPlanFeature) {
    setSelectedKey(feature.key);
    selectRoom(feature.locationId, planFeatureLabel(feature));
  }

  function enterEdit() {
    setMode("edit");
    setActionError(null);
    setSelectedLocationId(null);
    setSelectedLabel(null);
  }

  function exitEdit() {
    if (dirty) {
      setActionError("Save or discard changes before leaving edit mode.");
      return;
    }

    setMode("view");
    setDraftPolygon(null);
    setAssignTarget(null);
    setRedrawKey(null);
    setActionError(null);
  }

  function discardEdits() {
    const baseline = heldPlan ?? fetchedPlan;

    if (baseline) {
      setFeatures(featuresFromPlan(baseline));
    } else {
      setFeatures([]);
    }

    setDirty(false);
    setDraftPolygon(null);
    setAssignTarget(null);
    setRedrawKey(null);
    setSelectedKey(null);
    setActionError(null);
    setMode("view");
  }

  async function saveName(name: string) {
    const next = parseSitePlanBody(
      await apiRequest(`/api/site-plans/${loaded.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    );
    applyPlan(next);
  }

  async function replacePlan(file: File) {
    const problem = planFileProblem(file);

    if (problem) {
      setActionError(problem);
      return;
    }

    setPending(true);
    setActionError(null);

    try {
      const body = new FormData();
      body.set("plan", file);
      const next = parseSitePlanBody(
        await apiRequest(`/api/site-plans/${loaded.id}`, {
          method: "PATCH",
          body,
        }),
      );
      applyPlan(next);
      setMode("view");
    } catch (caught) {
      setActionError(asApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  async function removePlan() {
    setPending(true);
    setActionError(null);

    try {
      await apiRequest(`/api/site-plans/${loaded.id}`, { method: "DELETE" });
      router.push("/site-plans");
    } catch (caught) {
      setActionError(asApiError(caught).message);
      setConfirmingDelete(false);
      setPending(false);
    }
  }

  async function saveFeatures() {
    setSaving(true);
    setActionError(null);

    try {
      const next = parseSitePlanBody(
        await apiRequest(`/api/site-plans/${loaded.id}/features`, {
          method: "PUT",
          body: JSON.stringify(featuresPutBody(features)),
        }),
      );
      applyPlan(next);
    } catch (caught) {
      setActionError(asApiError(caught).message);
    } finally {
      setSaving(false);
    }
  }

  async function reloadRooms() {
    const list = parseLocationList(
      await apiRequest(`/api/sites/${loaded.site.id}/locations`),
    );
    setRoomsOverride(list.locations);
  }

  function finishDraft(draft: DraftPolygon) {
    if (
      draft.points.length < 3 ||
      draftPolygonBBoxDiagonal(draft.points) < MIN_PLAN_POLYGON_DIAGONAL
    ) {
      setDraftPolygon(null);
      return;
    }

    const geometry = pointsToPolygon(draft.points);
    setDraftPolygon(null);

    if (!geometry) {
      return;
    }

    if (redrawKey) {
      setFeatures((current) =>
        current.map((feature) =>
          feature.key === redrawKey ? { ...feature, geometry } : feature,
        ),
      );
      setDirty(true);
      setRedrawKey(null);
      setSelectedKey(redrawKey);
      return;
    }

    setAssignTarget({ kind: "new", geometry });
  }

  function assignToRoom(room: Location) {
    if (!assignTarget) {
      return;
    }

    if (
      assignTarget.kind === "new" &&
      features.some((feature) => feature.locationId === room.id)
    ) {
      setActionError("That room is already on the plan.");
      return;
    }

    if (assignTarget.kind === "reassign") {
      if (
        features.some(
          (feature) =>
            feature.key !== assignTarget.featureKey &&
            feature.locationId === room.id,
        )
      ) {
        setActionError("That room is already on the plan.");
        return;
      }

      setFeatures((current) =>
        current.map((feature) =>
          feature.key === assignTarget.featureKey
            ? {
                ...feature,
                locationId: room.id,
                location: {
                  id: room.id,
                  locationCode: room.locationCode,
                  name: room.name,
                  locationType: room.locationType,
                },
              }
            : feature,
        ),
      );
      setDirty(true);
      setSelectedKey(assignTarget.featureKey);
      setAssignTarget(null);
      setActionError(null);
      return;
    }

    const key = `local-${crypto.randomUUID()}`;
    const nextFeature: LocalPlanFeature = {
      key,
      locationId: room.id,
      location: {
        id: room.id,
        locationCode: room.locationCode,
        name: room.name,
        locationType: room.locationType,
      },
      geometry: assignTarget.geometry,
      labelOverride: null,
      sortOrder: features.length,
    };
    setFeatures((current) => [...current, nextFeature]);
    setDirty(true);
    setSelectedKey(key);
    setAssignTarget(null);
    setActionError(null);
  }

  function removeSelectedFeature() {
    if (!selectedKey) {
      return;
    }

    setFeatures((current) =>
      current
        .filter((feature) => feature.key !== selectedKey)
        .map((feature, index) => ({ ...feature, sortOrder: index })),
    );
    setDirty(true);
    setSelectedKey(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Breadcrumbs
        current
        items={[
          { label: loaded.client.name, href: `/clients/${loaded.client.id}` },
          { label: loaded.site.name, href: `/sites/${loaded.site.id}` },
          {
            label: locationDisplayName(loaded.location),
            href: `/locations/${loaded.location.id}`,
          },
          { label: loaded.name },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-500">Site plan</p>
            <Badge tone="info">Experiment</Badge>
            {dirty ? <Badge tone="light">Unsaved</Badge> : null}
          </div>
          <InlineTitle
            value={loaded.name}
            editable={canEdit && mode === "view"}
            maxLength={255}
            onSave={saveName}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && mode === "view" ? (
            <>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={pending}
                onClick={enterEdit}
              >
                Edit plan
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={pending}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                Replace file
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={pending}
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                Delete plan
              </button>
            </>
          ) : null}
          {canEdit && mode === "edit" ? (
            <>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={pending || saving || !dirty}
                onClick={() => {
                  void saveFeatures();
                }}
              >
                {saving ? "Saving…" : "Save features"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={pending || saving}
                onClick={dirty ? discardEdits : exitEdit}
              >
                {dirty ? "Discard" : "Done"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <SitePlanCanvas
          key={`${loaded.id}-${revision}`}
          url={loaded.url}
          contentType={loaded.contentType}
          features={features}
          canDraw={mode === "edit"}
          selectedKey={selectedKey}
          draftPolygon={draftPolygon}
          onDraftChange={setDraftPolygon}
          onDraftComplete={finishDraft}
          onSelectFeature={(feature) => {
            if (mode === "edit") {
              setSelectedKey(feature.key);
              return;
            }

            selectFeature(feature);
          }}
          onUrlExpired={refreshPlan}
        />

        <div className="flex min-w-0 flex-col gap-4">
          {mode === "view" ? (
            <>
              {features.length === 0 ? (
                <RoomFallbackList
                  rooms={rooms}
                  selectedLocationId={selectedLocationId}
                  onSelect={(room) => {
                    selectRoom(room.id, locationLabel(room));
                  }}
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
                    setSelectedLocationId(null);
                    setSelectedLabel(null);
                  }}
                />
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                {redrawKey
                  ? "Click corners to draw a new shape for the selected room. Double-click, press Enter, or click the first point to close. Escape cancels."
                  : "Click corners on the plan to draw a room. Double-click, press Enter, or click the first point to close, then assign it to a room. Escape cancels."}
              </p>
              {selectedFeature ? (
                <SelectedFeatureActions
                  feature={selectedFeature}
                  onReassign={() => {
                    setAssignTarget({
                      kind: "reassign",
                      featureKey: selectedFeature.key,
                    });
                  }}
                  onRedraw={() => {
                    setRedrawKey(selectedFeature.key);
                    setDraftPolygon(null);
                  }}
                  onRemove={removeSelectedFeature}
                />
              ) : null}
              <UnmappedRoomsList rooms={unmappedRooms} />
            </>
          )}
        </div>
      </div>

      {actionError ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {actionError}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          event.target.value = "";

          if (nextFile) {
            void replacePlan(nextFile);
          }
        }}
      />

      {assignTarget ? (
        <AssignRoomDialog
          rooms={rooms}
          features={features}
          reassignKey={
            assignTarget.kind === "reassign" ? assignTarget.featureKey : null
          }
          siteId={loaded.site.id}
          floorId={loaded.locationId}
          onAssign={assignToRoom}
          onCreatedRoom={async (room) => {
            await reloadRooms();
            assignToRoom(room);
          }}
          onClose={() => {
            setAssignTarget(null);
          }}
        />
      ) : null}

      {confirmingDelete ? (
        <Modal
          title="Delete site plan"
          onClose={() => {
            if (!pending) {
              setConfirmingDelete(false);
            }
          }}
        >
          <p className="text-sm leading-6 text-gray-700">
            Delete this site plan and its room overlays?
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={pending}
              onClick={() => {
                void removePlan();
              }}
            >
              {pending ? "Deleting…" : "Delete plan"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={pending}
              onClick={() => {
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function SelectedFeatureActions({
  feature,
  onReassign,
  onRedraw,
  onRemove,
}: {
  feature: LocalPlanFeature;
  onReassign: () => void;
  onRedraw: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-sm font-semibold text-gray-800">
        {planFeatureLabel(feature)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={secondaryButtonClassName} onClick={onReassign}>
          Reassign room
        </button>
        <button type="button" className={secondaryButtonClassName} onClick={onRedraw}>
          Redraw
        </button>
        <button type="button" className={secondaryButtonClassName} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function UnmappedRoomsList({ rooms }: { rooms: Location[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800">Not on plan</h3>
      {rooms.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          Every child room or area is mapped.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className="text-sm text-gray-800">{locationLabel(room)}</span>
              <Badge tone="light">{locationTypeLabel(room.locationType)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignRoomDialog({
  rooms,
  features,
  reassignKey,
  siteId,
  floorId,
  onAssign,
  onCreatedRoom,
  onClose,
}: {
  rooms: Location[];
  features: LocalPlanFeature[];
  reassignKey: string | null;
  siteId: string;
  floorId: string;
  onAssign: (room: Location) => void;
  onCreatedRoom: (room: Location) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const assignedElsewhere = new Set(
    features
      .filter((feature) => feature.key !== reassignKey)
      .map((feature) => feature.locationId),
  );
  const candidates = rooms.filter((room) => !assignedElsewhere.has(room.id));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((room) =>
        `${locationLabel(room)} ${room.locationCode ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : candidates;

  return (
    <Modal title="Assign room" onClose={onClose}>
      {creating ? (
        <CreateRoomForm
          siteId={siteId}
          floorId={floorId}
          onCancel={() => {
            setCreating(false);
          }}
          onCreated={(room) => {
            void onCreatedRoom(room);
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="site-plan-assign-room-search"
            >
              Room or area
            </label>
            <input
              id="site-plan-assign-room-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search rooms"
              className={inputClassName}
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                {candidates.length === 0
                  ? "No unmapped rooms under this floor."
                  : "No rooms match."}
              </li>
            ) : (
              matches.map((room) => (
                <li key={room.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                    onClick={() => {
                      onAssign(room);
                    }}
                  >
                    <span className="text-sm font-medium text-gray-800">
                      {locationLabel(room)}
                    </span>
                    <Badge tone="light">
                      {locationTypeLabel(room.locationType)}
                    </Badge>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setCreating(true);
              }}
            >
              Create new room…
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CreateRoomForm({
  siteId,
  floorId,
  onCancel,
  onCreated,
}: {
  siteId: string;
  floorId: string;
  onCancel: () => void;
  onCreated: (room: Location) => void;
}) {
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationType, setLocationType] = useState<"room" | "area">("room");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError(new ApiRequestError(400, "Enter a room name."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const room = parseLocationBody(
        await apiRequest(`/api/sites/${siteId}/locations`, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            locationCode: locationCode.trim() || null,
            locationType,
            parentLocationId: floorId,
            status: "active",
          }),
        }),
      );
      onCreated(room);
    } catch (caught) {
      setError(asApiError(caught));
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id={`site-plan-create-room-${floorId}-name`}
        label="Name"
        maxLength={200}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        id={`site-plan-create-room-${floorId}-code`}
        label="Code"
        maxLength={100}
        value={locationCode}
        disabled={pending}
        messages={fieldErrors.locationCode}
        onChange={(event) => {
          setLocationCode(event.target.value);
        }}
      />
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor={`site-plan-create-room-${floorId}-type`}
        >
          Type
        </label>
        <select
          id={`site-plan-create-room-${floorId}-type`}
          value={locationType}
          disabled={pending}
          onChange={(event) => {
            setLocationType(event.target.value as "room" | "area");
          }}
          className={inputClassName}
        >
          <option value="room">Room</option>
          <option value="area">Area</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={onCancel}
        >
          Back
        </button>
      </div>
    </form>
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
        No room overlays yet. Add child rooms under this floor to pick assets from
        a list.
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
