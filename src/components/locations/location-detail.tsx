"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetTable } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  ConfirmDelete,
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import {
  InlineSelect,
  InlineText,
  InlineTitle,
  Property,
} from "@/components/inline-field";
import { LocationPicker } from "@/components/locations/location-picker";
import { Modal } from "@/components/modal";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  LOCATION_STATUSES,
  LOCATION_TYPES,
  allowedChildTypes,
  locationLabel,
  locationPath,
  locationStatusLabel,
  locationTypeLabel,
  parentAllowsRoot,
  parentRequiresRoot,
  parseLocationBody,
  parseLocationList,
  type Location,
  type LocationStatus,
  type LocationType,
} from "@/lib/locations";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import {
  includeAsset,
  parseAssetList,
  parseSiteSummary,
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
  const siteRequest = useApi(
    canView && locationRequest.data
      ? `/api/sites/${locationRequest.data.siteId}`
      : null,
    parseSiteSummary,
  );
  const siteLocationsRequest = useApi(
    canView && locationRequest.data
      ? `/api/sites/${locationRequest.data.siteId}/locations`
      : null,
    parseLocationList,
  );
  const assetsRequest = useApi(
    canView ? `/api/locations/${id}/assets` : null,
    parseAssetList,
  );
  const [saved, setSaved] = useState<Location | null>(null);
  const [savedAssets, setSavedAssets] = useState<AssetList | null>(null);
  const [savedSiteLocations, setSavedSiteLocations] = useState<Location[] | null>(
    null,
  );
  const [assetsForLocation, setAssetsForLocation] = useState(id);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  if (
    locationRequest.loading ||
    siteRequest.loading ||
    (!assetsMissing && assetsRequest.loading)
  ) {
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

  if (assetsForLocation !== id) {
    setAssetsForLocation(id);
    setSaved(null);
    setSavedAssets(null);
    setSavedSiteLocations(null);
    setDeleteError(null);
  }

  const location =
    saved?.id === locationRequest.data?.id ? saved : locationRequest.data;
  const site = siteRequest.data;
  const siteLocations =
    savedSiteLocations ?? siteLocationsRequest.data?.locations ?? [];
  const assets =
    assetsForLocation === id && savedAssets
      ? savedAssets
      : assetsMissing
        ? { assetCount: 0, assets: [] }
        : assetsRequest.data;

  if (!location || !site || !assets) {
    return null;
  }

  const loaded = location;
  const loadedAssets = assets;
  const path = locationPath(siteLocations, location.id);
  const children = siteLocations.filter(
    (candidate) => candidate.parentLocationId === location.id,
  );

  async function saveLocation(patch: Record<string, unknown>) {
    try {
      const next = parseLocationBody(
        await apiRequest(`/api/locations/${loaded.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      );
      setSaved(next);

      if (
        "parentLocationId" in patch ||
        "locationType" in patch ||
        "name" in patch ||
        "locationCode" in patch
      ) {
        try {
          const list = parseLocationList(
            await apiRequest(`/api/sites/${loaded.siteId}/locations`),
          );
          setSavedSiteLocations(list.locations);
        } catch {
          /* keep previous tree */
        }
      }
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        router.replace("/sites");
      }

      throw apiError;
    }
  }

  async function reloadAssets(asset?: AssetList["assets"][number]) {
    try {
      const list = parseAssetList(await apiRequest(`/api/locations/${loaded.id}/assets`));
      setSavedAssets(asset ? includeAsset(list, asset) : list);
    } catch {
      if (asset) {
        setSavedAssets(includeAsset(loadedAssets, asset));
      }
    }
  }

  async function reloadSiteLocations() {
    const list = parseLocationList(
      await apiRequest(`/api/sites/${loaded.siteId}/locations`),
    );
    setSavedSiteLocations(list.locations);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/locations/${loaded.id}`, { method: "DELETE" });
      router.push(`/sites/${loaded.siteId}`);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 409) {
        setDeleteError("Remove or reassign child locations and assets first.");
      } else {
        setDeleteError(apiError.message);
      }

      setDeleting(false);
    }
  }

  const crumbItems = [
    ...(location.client
      ? [{ label: location.client.name, href: `/clients/${location.client.id}` }]
      : []),
    { label: site.name, href: `/sites/${site.id}` },
    ...path.slice(0, -1).map((item) => ({
      label: locationLabel(item),
      href: `/locations/${item.id}`,
    })),
    { label: locationLabel(location) },
  ];

  return (
    <div className="grid min-w-0 gap-8">
      <Breadcrumbs current items={crumbItems} />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="grid min-w-0 gap-8">
          <section>
            <p className="text-sm text-gray-500">
              {locationTypeLabel(location.locationType)}
            </p>
            <InlineTitle
              value={location.name ?? ""}
              display={locationLabel(location)}
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
            <div className="mt-3 max-w-md">
              <InlineText
                label="Code"
                field="locationCode"
                value={location.locationCode ?? ""}
                editable={canEdit}
                maxLength={100}
                onSave={async (locationCode) => {
                  if (!locationCode && !location.name) {
                    throw new ApiRequestError(400, "Invalid request", {
                      locationCode: ["Enter a name or a location code."],
                    });
                  }

                  await saveLocation({ locationCode: locationCode || null });
                }}
              />
            </div>
          </section>

          <LocationSection title="Description">
            <InlineText
              label="Description"
              field="description"
              value={location.description ?? ""}
              editable={canEdit}
              onSave={async (description) => {
                await saveLocation({ description: description || null });
              }}
            />
          </LocationSection>

          <LocationSection title="Address">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <InlineText
                  label="Address"
                  field="address"
                  value={location.address ?? ""}
                  editable={canEdit}
                  onSave={async (address) => {
                    await saveLocation({ address: address || null });
                  }}
                />
              </div>
              <InlineText
                label="Latitude"
                field="latitude"
                type="number"
                value={location.latitude == null ? "" : String(location.latitude)}
                editable={canEdit}
                onSave={async (raw) => {
                  if (!raw) {
                    await saveLocation({ latitude: null });
                    return;
                  }

                  const latitude = Number(raw);

                  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                    throw new ApiRequestError(400, "Invalid request", {
                      latitude: ["Enter a latitude between -90 and 90."],
                    });
                  }

                  await saveLocation({ latitude });
                }}
              />
              <InlineText
                label="Longitude"
                field="longitude"
                type="number"
                value={location.longitude == null ? "" : String(location.longitude)}
                editable={canEdit}
                onSave={async (raw) => {
                  if (!raw) {
                    await saveLocation({ longitude: null });
                    return;
                  }

                  const longitude = Number(raw);

                  if (
                    !Number.isFinite(longitude) ||
                    longitude < -180 ||
                    longitude > 180
                  ) {
                    throw new ApiRequestError(400, "Invalid request", {
                      longitude: ["Enter a longitude between -180 and 180."],
                    });
                  }

                  await saveLocation({ longitude });
                }}
              />
            </div>
          </LocationSection>

          <ChildLocationsSection
            parent={location}
            childLocations={children}
            canEdit={canEdit}
            onCreated={reloadSiteLocations}
            onMissing={() => {
              router.replace("/sites");
            }}
          />

          <LocationAssetsSection
            locationId={location.id}
            assets={assets}
            locations={siteLocations}
            canEdit={canEdit}
            onCreated={(asset) => {
              void reloadAssets(asset);
            }}
          />

          {canEdit ? (
            <div className="grid gap-3">
              {deleteError ? (
                <p className="text-sm leading-6 text-ink" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <ConfirmDelete
                label="Delete location"
                question="Delete this location?"
                pending={deleting}
                onConfirm={() => {
                  void remove();
                }}
              />
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 overflow-visible rounded-card border border-gray-200 bg-surface p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold text-gray-800">Details</h2>
          <dl className="mt-5 grid min-w-0 gap-5 overflow-visible [&>*]:min-w-0">
            <InlineSelect
              label="Status"
              field="status"
              value={location.status}
              editable={canEdit}
              options={LOCATION_STATUSES.map((status) => ({
                value: status,
                label: locationStatusLabel(status),
              }))}
              onSave={async (status) => {
                await saveLocation({ status: status as LocationStatus });
              }}
            />
            <InlineSelect
              label="Type"
              field="locationType"
              value={location.locationType ?? ""}
              editable={canEdit}
              options={[
                { value: "", label: "Unclassified" },
                ...LOCATION_TYPES.map((type) => ({
                  value: type,
                  label: locationTypeLabel(type),
                })),
              ]}
              onSave={async (raw) => {
                const nextType = (raw || null) as LocationType | null;

                if (parentRequiresRoot(nextType) && location.parentLocationId) {
                  await saveLocation({
                    locationType: nextType,
                    parentLocationId: null,
                  });
                  return;
                }

                await saveLocation({ locationType: nextType });
              }}
            />
            <ParentLocationField
              location={location}
              locations={siteLocations}
              loading={siteLocationsRequest.loading}
              editable={canEdit}
              onSave={async (parentLocationId) => {
                await saveLocation({ parentLocationId });
              }}
            />
            <InlineText
              label="Department"
              field="department"
              value={location.department ?? ""}
              editable={canEdit}
              onSave={async (department) => {
                await saveLocation({ department: department || null });
              }}
            />
            <InlineText
              label="UPRN"
              field="uprn"
              value={location.uprn ?? ""}
              editable={canEdit}
              maxLength={12}
              onSave={async (uprn) => {
                await saveLocation({ uprn: uprn || null });
              }}
            />
            {location.client ? (
              <Property label="Client">
                <Link
                  href={`/clients/${location.client.id}`}
                  className="text-brand-500 hover:underline"
                >
                  {location.client.name}
                </Link>
              </Property>
            ) : null}
            <Property label="Site">
              <Link href={`/sites/${site.id}`} className="text-brand-500 hover:underline">
                {site.name}
              </Link>
            </Property>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function LocationSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const sectionAddButtonClassName =
  "inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50";

function SectionAddButton({
  label,
  cancelLabel = "Cancel",
  active,
  disabled,
  onClick,
}: {
  label: string;
  cancelLabel?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={sectionAddButtonClassName}
    >
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      {active ? cancelLabel : label}
    </button>
  );
}

function ChildLocationsSection({
  parent,
  childLocations,
  canEdit,
  onCreated,
  onMissing,
}: {
  parent: Location;
  childLocations: Location[];
  canEdit: boolean;
  onCreated: () => Promise<void>;
  onMissing: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const childTypes = allowedChildTypes(parent.locationType);
  const canAdd = canEdit && childTypes.length > 0;

  const addButton = canAdd ? (
    <SectionAddButton
      label="Add"
      active={adding}
      onClick={() => {
        setAdding((current) => !current);
      }}
    />
  ) : null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">Child locations</h2>
        {childLocations.length > 0 || adding ? addButton : null}
      </div>
      <div className="mt-3">
        {childLocations.length === 0 && !adding ? (
          canAdd ? (
            addButton
          ) : parent.locationType == null ? (
            <p className="text-sm text-gray-500">
              Set a type before adding child locations.
            </p>
          ) : parent.locationType === "room" ? (
            <p className="text-sm text-gray-500">Rooms cannot have child locations.</p>
          ) : (
            <p className="text-sm text-gray-500">No child locations.</p>
          )
        ) : null}
        {childLocations.length > 0 ? (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {childLocations.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/locations/${child.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {locationLabel(child)}
                  </span>
                  <Badge tone="light">{locationTypeLabel(child.locationType)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {adding ? (
          <Modal
            title="Add child location"
            onClose={() => {
              setAdding(false);
            }}
          >
            <ChildLocationForm
              siteId={parent.siteId}
              parentLocationId={parent.id}
              childTypes={childTypes}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={async () => {
                setAdding(false);
                await onCreated();
              }}
              onMissing={onMissing}
            />
          </Modal>
        ) : null}
      </div>
    </section>
  );
}

function LocationAssetsSection({
  locationId,
  assets,
  locations,
  canEdit,
  onCreated,
}: {
  locationId: string;
  assets: AssetList;
  locations: Location[];
  canEdit: boolean;
  onCreated: (asset: AssetList["assets"][number]) => void;
}) {
  const [adding, setAdding] = useState(false);

  const addButton = canEdit ? (
    <SectionAddButton
      label="Add"
      active={adding}
      onClick={() => {
        setAdding((current) => !current);
      }}
    />
  ) : null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">Assets</h2>
        {assets.assets.length > 0 || adding ? addButton : null}
      </div>
      <div className="mt-3">
        {assets.assets.length === 0 && !adding ? (
          canEdit ? (
            addButton
          ) : (
            <p className="text-sm text-gray-500">No assets yet.</p>
          )
        ) : assets.assets.length > 0 ? (
          <AssetTable assets={assets.assets} locations={locations} />
        ) : null}
        {adding ? (
          <Modal
            title="Add asset"
            onClose={() => {
              setAdding(false);
            }}
          >
            <AssetForm
              locationId={locationId}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={(asset) => {
                setAdding(false);
                onCreated(asset);
              }}
            />
          </Modal>
        ) : null}
      </div>
    </section>
  );
}

function ChildLocationForm({
  siteId,
  parentLocationId,
  childTypes,
  onCancel,
  onCreated,
  onMissing,
}: {
  siteId: string;
  parentLocationId: string;
  childTypes: LocationType[];
  onCancel: () => void;
  onCreated: () => Promise<void>;
  onMissing: () => void;
}) {
  const defaultType = childTypes[0] ?? "area";
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationType, setLocationType] = useState<LocationType>(defaultType);
  const [status, setStatus] = useState<LocationStatus>("active");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() && !locationCode.trim()) {
      setError(new ApiRequestError(400, "Enter a name or a location code."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseLocationBody(
        await apiRequest(`/api/sites/${siteId}/locations`, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim() || null,
            locationCode: locationCode.trim() || null,
            locationType,
            parentLocationId,
            status,
          }),
        }),
      );
      await onCreated();
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setError(apiError);
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id={`child-location-${parentLocationId}-name`}
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
        id={`child-location-${parentLocationId}-code`}
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
          htmlFor={`child-location-${parentLocationId}-type`}
        >
          Type
        </label>
        <select
          id={`child-location-${parentLocationId}-type`}
          value={locationType}
          disabled={pending}
          onChange={(event) => {
            setLocationType(event.target.value as LocationType);
          }}
          className={inputClassName}
        >
          {childTypes.map((type) => (
            <option key={type} value={type}>
              {locationTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor={`child-location-${parentLocationId}-status`}
        >
          Status
        </label>
        <select
          id={`child-location-${parentLocationId}-status`}
          value={status}
          disabled={pending}
          onChange={(event) => {
            setStatus(event.target.value as LocationStatus);
          }}
          className={inputClassName}
        >
          {LOCATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {locationStatusLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : "Add location"}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ParentLocationField({
  location,
  locations,
  loading,
  editable,
  onSave,
}: {
  location: Location;
  locations: Location[];
  loading: boolean;
  editable: boolean;
  onSave: (parentLocationId: string | null) => Promise<void>;
}) {
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const currentId = location.parentLocationId ?? "";
  const rootOnly = parentRequiresRoot(location.locationType);

  return (
    <Property label="Parent location">
      {editable ? (
        <>
          <LocationPicker
            id={`location-${location.id}-parent`}
            locations={locations}
            value={currentId}
            mode="parent"
            childType={location.locationType}
            excludeId={location.id}
            disabled={rootOnly || pending}
            loading={loading}
            clearLabel={
              parentAllowsRoot(location.locationType) ? "Site (no parent)" : undefined
            }
            onChange={(parentLocationId) => {
              if (parentLocationId === currentId || pending) {
                return;
              }

              setPending(true);
              setError(null);
              void onSave(parentLocationId || null)
                .catch((caught) => {
                  setError(asApiError(caught));
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          />
          {error ? (
            <>
              <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
              <FieldMessages messages={error.fieldErrors.parentLocationId} />
            </>
          ) : null}
        </>
      ) : location.parentLocation ? (
        <Link
          href={`/locations/${location.parentLocation.id}`}
          className="text-brand-500 hover:underline"
        >
          {locationLabel(location.parentLocation)}
        </Link>
      ) : (
        <span>Site root</span>
      )}
    </Property>
  );
}
