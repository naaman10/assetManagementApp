"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetTable } from "@/components/assets/asset-table";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import {
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import {
  InlineAddress,
  InlineSelect,
  InlineText,
  InlineTitle,
  PropertyGrid,
} from "@/components/inline-field";
import { LocationPicker } from "@/components/locations/location-picker";
import { LocationTree } from "@/components/locations/location-tree";
import { Modal } from "@/components/modal";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseClientBody } from "@/lib/clients";
import {
  LOCATION_STATUSES,
  LOCATION_TYPES,
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
  parseSiteDetail,
  type AssetList,
  type SiteContact as Contact,
  type SiteDetail,
  type SiteLocation,
  type Asset,
} from "@/lib/sites";

const tabs = [
  { id: "locations", label: "Locations" },
  { id: "assets", label: "Assets" },
] as const;

type SiteTab = (typeof tabs)[number]["id"];

export function SiteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const request = useApi(canView ? `/api/sites/${id}` : null, parseSiteDetail);
  const assetsRequest = useApi(canView ? `/api/sites/${id}/assets` : null, parseAssetList);
  const contactsClientId = canEdit ? (request.data?.client.id ?? null) : null;
  const contactsRequest = useApi(
    contactsClientId ? `/api/clients/${contactsClientId}` : null,
    parseClientBody,
  );
  const [saved, setSaved] = useState<SiteDetail | null>(null);
  const [savedAssets, setSavedAssets] = useState<AssetList | null>(null);
  const [assetsForSite, setAssetsForSite] = useState(id);
  const [tab, setTab] = useState<SiteTab>("locations");
  const [tabForSite, setTabForSite] = useState(id);
  const tablistId = useId();
  const missing = request.error?.status === 404;
  const assetsMissing = assetsRequest.error?.status === 404;
  const site = saved?.id === request.data?.id ? saved : request.data;
  const assetList =
    assetsForSite === id && savedAssets
      ? savedAssets
      : assetsMissing
        ? { assetCount: 0, assets: [] }
        : assetsRequest.data;

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

  if (request.loading || (!assetsMissing && assetsRequest.loading)) {
    return <p className="text-sm text-muted">Loading site…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {request.error.message}
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

  if (!site || !assetList) {
    return null;
  }

  if (tabForSite !== id || assetsForSite !== id) {
    setTabForSite(id);
    setAssetsForSite(id);
    setTab("locations");
    setSavedAssets(null);
  }

  const loaded = site;
  const contactChoices = contactOptions(contactsRequest.data?.contacts ?? [], site.contact);

  async function saveSite(patch: Record<string, unknown>) {
    try {
      setSaved(
        parseSiteDetail(
          await apiRequest(`/api/sites/${loaded.id}`, {
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

  async function reloadLogo(): Promise<string | null> {
    try {
      const body = await apiRequest(`/api/clients/${loaded.client.id}`);
      const client = parseClientBody(body);
      setSaved({
        ...loaded,
        client: { ...loaded.client, logoUrl: client.logoUrl },
        locations: loaded.locations,
        locationCount: loaded.locationCount,
      });
      return client.logoUrl;
    } catch (error) {
      if (asApiError(error).status === 404) {
        router.replace("/sites");
      }

      throw error;
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <Link
              href={`/clients/${site.client.id}`}
              className="flex w-fit items-center gap-3"
            >
              <ClientLogo
                name={loaded.client.name}
                logoUrl={loaded.client.logoUrl}
                size="list"
                onReload={reloadLogo}
              />
              <span className="font-medium">{site.client.name}</span>
            </Link>
            <p className="mt-6 text-sm text-gray-500">Site</p>
            <InlineTitle
              value={site.name}
              editable={canEdit}
              onSave={async (name) => {
                if (!name) {
                  throw new ApiRequestError(400, "Invalid request", {
                    name: ["Enter a name."],
                  });
                }

                await saveSite({ name });
              }}
            />
            <PropertyGrid>
              <InlineText
                label="Reference"
                field="reference"
                value={site.reference ?? ""}
                editable={canEdit}
                maxLength={200}
                onSave={async (reference) => {
                  await saveSite({ reference: reference || null });
                }}
              />
              <InlineSelect
                label="Contact"
                field="contactId"
                value={site.contact.id}
                editable={canEdit}
                options={contactChoices.map((contact) => ({
                  value: contact.id,
                  label: contact.name,
                }))}
                aside={<ContactActions contact={site.contact} />}
                onSave={async (contactId) => {
                  await saveSite({ contactId });
                }}
              />
              <InlineAddress
                address={site.address}
                editable={canEdit}
                onSave={async (address) => {
                  await saveSite({ address });
                }}
              />
            </PropertyGrid>
          </div>
        </div>
      </section>
      <section>
        <div
          role="tablist"
          aria-label="Site records"
          className="flex flex-wrap gap-6 border-b border-gray-200"
        >
          {tabs.map((item) => {
            const selected = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${tablistId}-${item.id}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-${item.id}-panel`}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
                  selected
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {item.label}
                <span className="ml-2 font-medium text-gray-500">
                  {item.id === "locations" ? site.locationCount : assetList.assetCount}
                </span>
              </button>
            );
          })}
        </div>
        {tabs.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${tablistId}-${item.id}-panel`}
            aria-labelledby={`${tablistId}-${item.id}`}
            hidden={tab !== item.id}
            className="mt-6"
          >
            {item.id === "locations" ? (
              <Locations
                siteId={site.id}
                locations={site.locations}
                canEdit={canEdit}
                onSite={setSaved}
                onMissing={() => {
                  router.replace("/sites");
                }}
              />
            ) : (
              <SiteAssets
                siteId={site.id}
                locations={site.locations}
                assets={assetList}
                canEdit={canEdit}
                onAssets={setSavedAssets}
                onShowLocations={() => {
                  setTab("locations");
                }}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function SiteAssets({
  siteId,
  locations: nestedLocations,
  assets,
  canEdit,
  onAssets,
  onShowLocations,
}: {
  siteId: string;
  locations: SiteLocation[];
  assets: AssetList;
  canEdit: boolean;
  onAssets: (assets: AssetList) => void;
  onShowLocations: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [openForSite, setOpenForSite] = useState(siteId);
  const listRequest = useApi(`/api/sites/${siteId}/locations`, parseLocationList);
  const locations = listRequest.data?.locations ?? nestedLocations;

  if (openForSite !== siteId) {
    setOpenForSite(siteId);
    setAdding(false);
  }

  async function created(asset: Asset) {
    setAdding(false);

    try {
      const list = parseAssetList(await apiRequest(`/api/sites/${siteId}/assets`));
      onAssets(includeAsset(list, asset));
    } catch {
      onAssets(includeAsset(assets, asset));
    }
  }

  return (
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
      {assets.assets.length === 0 ? (
        <p className="text-sm text-gray-500">No assets yet.</p>
      ) : (
        <AssetTable
          assets={assets.assets}
          includeLocation
          locations={locations}
        />
      )}
      {adding ? (
        <Modal
          title="Add asset"
          onClose={() => {
            setAdding(false);
          }}
        >
          {locations.length === 0 ? (
            <div className="grid gap-4">
              <p className="text-sm leading-6">
                A location is required to add an asset. Add one from the{" "}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => {
                    setAdding(false);
                    onShowLocations();
                  }}
                >
                  Locations tab
                </button>
                .
              </p>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <AssetForm
              locations={locations}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={(asset) => {
                void created(asset);
              }}
            />
          )}
        </Modal>
      ) : null}
    </section>
  );
}

function Locations({
  siteId,
  locations: nestedLocations,
  canEdit,
  onSite,
  onMissing,
}: {
  siteId: string;
  locations: SiteDetail["locations"];
  canEdit: boolean;
  onSite: (site: SiteDetail) => void;
  onMissing: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [openForSite, setOpenForSite] = useState(siteId);
  const [savedLocations, setSavedLocations] = useState<Location[] | null>(null);
  const listRequest = useApi(`/api/sites/${siteId}/locations`, parseLocationList);
  const locations =
    savedLocations ?? listRequest.data?.locations ?? nestedLocations;

  if (openForSite !== siteId) {
    setOpenForSite(siteId);
    setAdding(false);
    setSavedLocations(null);
  }

  return (
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
            Add location
          </button>
        </div>
      ) : null}
      {listRequest.loading && !listRequest.data && !savedLocations ? (
        <p className="mt-6 text-sm text-gray-500">Loading locations…</p>
      ) : listRequest.error && !savedLocations ? (
        <p className="mt-6 text-sm text-error-600" role="alert">
          {asApiError(listRequest.error).message}
        </p>
      ) : (
        <LocationTree locations={locations} />
      )}
      {adding ? (
        <Modal
          title="Add location"
          onClose={() => {
            setAdding(false);
          }}
        >
          <LocationForm
            siteId={siteId}
            locations={locations}
            onCancel={() => {
              setAdding(false);
            }}
            onCreated={async () => {
              setAdding(false);
              const list = parseLocationList(
                await apiRequest(`/api/sites/${siteId}/locations`),
              );
              setSavedLocations(list.locations);
              onSite(parseSiteDetail(await apiRequest(`/api/sites/${siteId}`)));
            }}
            onMissing={onMissing}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function LocationForm({
  siteId,
  locations,
  onCancel,
  onCreated,
  onMissing,
}: {
  siteId: string;
  locations: Location[];
  onCancel: () => void;
  onCreated: () => Promise<void>;
  onMissing: () => void;
}) {
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationType, setLocationType] = useState<"" | LocationType>("");
  const [parentLocationId, setParentLocationId] = useState("");
  const [status, setStatus] = useState<LocationStatus>("active");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [uprn, setUprn] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const typeValue = locationType === "" ? null : locationType;
  const rootOnly = parentRequiresRoot(typeValue);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = createLocationPayload({
      name,
      locationCode,
      locationType: typeValue,
      parentLocationId: rootOnly ? "" : parentLocationId,
      status,
      description,
      department,
      uprn,
    });

    if (!payload.body.name && !payload.body.locationCode) {
      setError(new ApiRequestError(400, "Enter a name or a location code."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseLocationBody(
        await apiRequest(`/api/sites/${siteId}/locations`, {
          method: "POST",
          body: JSON.stringify(payload.body),
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
    <form className="grid max-h-[70vh] gap-5 overflow-y-auto pr-1" onSubmit={onSubmit}>
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id={`location-${siteId}-name`}
        label="Name"
        name="name"
        maxLength={200}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        id={`location-${siteId}-code`}
        label="Code"
        name="locationCode"
        maxLength={100}
        value={locationCode}
        disabled={pending}
        messages={fieldErrors.locationCode}
        onChange={(event) => {
          setLocationCode(event.target.value);
        }}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor={`location-${siteId}-type`}>
          Type
        </label>
        <select
          id={`location-${siteId}-type`}
          value={locationType}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value as "" | LocationType;
            setLocationType(next);

            if (parentRequiresRoot(next === "" ? null : next)) {
              setParentLocationId("");
            }
          }}
          className={inputClassName}
        >
          <option value="">Unclassified</option>
          {LOCATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {locationTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          id={`location-${siteId}-parent-label`}
          className="block text-sm font-medium text-gray-700"
          htmlFor={`location-${siteId}-parent`}
        >
          Parent location
        </label>
        <LocationPicker
          id={`location-${siteId}-parent`}
          locations={locations}
          value={parentLocationId}
          mode="parent"
          childType={typeValue}
          disabled={pending || rootOnly}
          clearLabel={parentAllowsRoot(typeValue) ? "Site (no parent)" : undefined}
          onChange={setParentLocationId}
        />
        {rootOnly ? (
          <p className="mt-1.5 text-xs text-gray-500">
            {typeValue === "building" || typeValue == null
              ? "This type must sit at the site root."
              : null}
          </p>
        ) : null}
      </div>
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor={`location-${siteId}-status`}
        >
          Status
        </label>
        <select
          id={`location-${siteId}-status`}
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
      <TextField
        id={`location-${siteId}-description`}
        label="Description"
        value={description}
        disabled={pending}
        messages={fieldErrors.description}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
      />
      <TextField
        id={`location-${siteId}-department`}
        label="Department"
        value={department}
        disabled={pending}
        messages={fieldErrors.department}
        onChange={(event) => {
          setDepartment(event.target.value);
        }}
      />
      <TextField
        id={`location-${siteId}-uprn`}
        label="UPRN"
        maxLength={12}
        value={uprn}
        disabled={pending}
        messages={fieldErrors.uprn}
        onChange={(event) => {
          setUprn(event.target.value);
        }}
      />
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

function createLocationPayload(draft: {
  name: string;
  locationCode: string;
  locationType: LocationType | null;
  parentLocationId: string;
  status: LocationStatus;
  description: string;
  department: string;
  uprn: string;
}): { body: Record<string, string | number | null> } {
  return {
    body: {
      name: emptyToNull(draft.name),
      locationCode: emptyToNull(draft.locationCode),
      locationType: draft.locationType,
      parentLocationId: draft.parentLocationId.trim() || null,
      status: draft.status,
      description: emptyToNull(draft.description),
      department: emptyToNull(draft.department),
      uprn: emptyToNull(draft.uprn),
    },
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function contactOptions(
  contacts: readonly Contact[],
  current: Contact,
): readonly Contact[] {
  if (contacts.some((contact) => contact.id === current.id)) {
    return contacts;
  }

  return [current, ...contacts];
}

function ContactActions({ contact }: { contact: Contact }) {
  const email = mailtoHref(contact.email);
  const telephone = telHref(contact.telephone);

  if (!contact.role && !email && !telephone) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {contact.role ? (
        <span className="text-sm font-normal text-gray-500">{contact.role}</span>
      ) : null}
      {email ? (
        <a
          href={email}
          aria-label={`Email ${contact.name}`}
          title={contact.email ?? undefined}
          className="flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
        >
          <MailIcon />
        </a>
      ) : null}
      {telephone ? (
        <a
          href={telephone}
          aria-label={`Call ${contact.name}`}
          title={contact.telephone ?? undefined}
          className="flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
        >
          <PhoneIcon />
        </a>
      ) : null}
    </div>
  );
}

function mailtoHref(email: string | null): string | null {
  const value = email?.trim() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return null;
  }

  return `mailto:${value}`;
}

function telHref(telephone: string | null): string | null {
  const value = telephone?.trim() ?? "";

  if (!/^[+0-9().\s-]{3,}$/.test(value)) {
    return null;
  }

  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2.5 4.5 8 8.5 13.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M5.2 2.8h1.1c.4 0 .7.2.8.6l.5 1.5a.8.8 0 0 1-.4 1l-.9.4a6.4 6.4 0 0 0 3.4 3.4l.4-.9a.8.8 0 0 1 1-.4l1.5.5c.4.1.6.4.6.8v1.1c0 .5-.4.9-.9.9-5.2.6-8.8-3-8.2-8.2 0-.5.4-.9.9-.9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
