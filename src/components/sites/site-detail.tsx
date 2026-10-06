"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetTable } from "@/components/assets/asset-table";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import {
  DataTable,
  FormBanner,
  TextField,
  bannerMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseClientBody, type Address } from "@/lib/clients";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import {
  includeAsset,
  parseAssetList,
  parseLocationBody,
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
    <div className="grid gap-8">
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
            <h1 className="mt-1 text-2xl font-semibold text-gray-800">{site.name}</h1>
            <p className="mt-3 text-sm text-muted">Reference</p>
            <p className="mt-1 text-sm font-medium">{site.reference ?? "—"}</p>
            <p className="mt-3 text-sm leading-6 whitespace-pre-line">
              {formatAddress(site.address)}
            </p>
          </div>
          {canEdit ? (
            <Link href={`/sites/${site.id}/edit`} className={secondaryButtonClassName}>
              Edit
            </Link>
          ) : null}
        </div>
        <SiteContact contact={site.contact} />
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
  locations,
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
      {assets.assets.length === 0 && !adding ? (
        <p className="text-sm text-gray-500">No assets yet.</p>
      ) : assets.assets.length > 0 ? (
        <AssetTable assets={assets.assets} includeLocation />
      ) : null}
      {adding ? (
        locations.length === 0 ? (
          <div className="mt-4 grid gap-4 rounded-card bg-surface p-5 shadow-card">
            <p className="text-sm leading-6">
              A location is required to add an asset. Add one from the{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={onShowLocations}
              >
                Locations tab
              </button>
              .
            </p>
            <button type="button" className={secondaryButtonClassName} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-card bg-surface p-5 shadow-card">
            <AssetForm
              locations={locations}
              onCancel={() => {
                setAdding(false);
              }}
              onCreated={(asset) => {
                void created(asset);
              }}
            />
          </div>
        )
      ) : null}
    </section>
  );
}

function Locations({
  siteId,
  locations,
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

  if (openForSite !== siteId) {
    setOpenForSite(siteId);
    setAdding(false);
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
      {locations.length === 0 && !adding ? (
        <p className="mt-6 text-sm text-gray-500">No locations yet.</p>
      ) : locations.length > 0 ? (
        <DataTable columns={["Name", "Location code"]}>
          {locations.map((location) => (
            <tr key={location.id} className="hover:bg-gray-50">
              <td className="px-5 py-4">
                <Link
                  href={`/locations/${location.id}`}
                  className="text-sm font-medium text-gray-800"
                >
                  {locationLinkText(location)}
                </Link>
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">
                {location.locationCode ?? "—"}
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {adding ? (
        <div className="mt-4 rounded-card bg-surface p-5 shadow-card">
          <LocationForm
            siteId={siteId}
            onCancel={() => {
              setAdding(false);
            }}
            onCreated={(site) => {
              setAdding(false);
              onSite(site);
            }}
            onMissing={onMissing}
          />
        </div>
      ) : null}
    </section>
  );
}

function LocationForm({
  siteId,
  onCancel,
  onCreated,
  onMissing,
}: {
  siteId: string;
  onCancel: () => void;
  onCreated: (site: SiteDetail) => void;
  onMissing: () => void;
}) {
  const [name, setName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = locationPayload(name, locationCode);

    if (!payload) {
      setError(new ApiRequestError(400, "Enter a name or a location code."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseLocationBody(
        await apiRequest(`/api/sites/${siteId}/locations`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      onCreated(parseSiteDetail(await apiRequest(`/api/sites/${siteId}`)));
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
        label="Location code"
        name="locationCode"
        maxLength={200}
        value={locationCode}
        disabled={pending}
        messages={fieldErrors.locationCode}
        onChange={(event) => {
          setLocationCode(event.target.value);
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

function locationPayload(name: string, locationCode: string): Record<string, string> | null {
  const payload: Record<string, string> = {};
  const trimmedName = name.trim();
  const trimmedCode = locationCode.trim();

  if (trimmedName) {
    payload.name = trimmedName;
  }

  if (trimmedCode) {
    payload.locationCode = trimmedCode;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function locationLinkText(location: SiteLocation): string {
  return location.name ?? location.locationCode ?? "Location";
}

function formatAddress(address: Address): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode,
    address.country,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function SiteContact({ contact }: { contact: Contact }) {
  const email = mailtoHref(contact.email);
  const telephone = telHref(contact.telephone);

  return (
    <div className="mt-8 inline-flex max-w-full items-center gap-4 rounded-2xl border border-line px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{contact.name}</p>
        {contact.role ? (
          <p className="mt-1 truncate text-sm text-muted">{contact.role}</p>
        ) : null}
      </div>
      {email || telephone ? (
        <div className="flex shrink-0 gap-2">
          {email ? (
            <a
              href={email}
              aria-label={`Email ${contact.name}`}
              title={contact.email ?? undefined}
              className="flex size-10 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <MailIcon />
            </a>
          ) : null}
          {telephone ? (
            <a
              href={telephone}
              aria-label={`Call ${contact.name}`}
              title={contact.telephone ?? undefined}
              className="flex size-10 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <PhoneIcon />
            </a>
          ) : null}
        </div>
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
