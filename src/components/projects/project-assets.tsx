"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AssetForm } from "@/components/assets/asset-form";
import { DataTable, inputClassName } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { ReviewStatusBadge } from "@/components/projects/review-status-badge";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseLocationList, type Location } from "@/lib/locations";
import { parseClientSites, type Project } from "@/lib/projects";
import {
  parseAssetBody,
  parseAssetList,
  type Asset,
} from "@/lib/sites";

const sectionAddButtonClassName =
  "inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50";

export function ProjectAssetsSection({
  project,
  canEdit,
  onChanged,
}: {
  project: Project;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pending, setPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Asset[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const clientSitesRequest = useApi(
    canEdit && (adding || creating) ? `/api/clients/${project.client.id}` : null,
    parseClientSites,
  );
  const linkedIds = new Set(project.assets.map((asset) => asset.id));
  const available = candidates.filter((asset) => !linkedIds.has(asset.id));
  const matches = filterByQuery(
    available,
    query,
    (asset) => `${asset.tag} ${asset.assetName ?? ""}`,
  );
  const clientSites = clientSitesRequest.data;

  useEffect(() => {
    if (!adding || !clientSites) {
      return;
    }

    let cancelled = false;
    const sites = clientSites.sites;

    async function loadCandidates() {
      setCandidatesLoading(true);
      setCandidatesError(null);

      try {
        const lists = await Promise.all(
          sites.map(async (site) =>
            parseAssetList(await apiRequest(`/api/sites/${site.id}/assets`)),
          ),
        );

        if (!cancelled) {
          setCandidates(lists.flatMap((list) => list.assets));
        }
      } catch (caught) {
        if (!cancelled) {
          setCandidates([]);
          setCandidatesError(asApiError(caught).message);
        }
      } finally {
        if (!cancelled) {
          setCandidatesLoading(false);
        }
      }
    }

    void loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [adding, clientSites]);

  useEffect(() => {
    if (!creating || !clientSites) {
      return;
    }

    let cancelled = false;
    const sites = clientSites.sites;

    async function loadLocations() {
      setLocationsLoading(true);
      setLocationsError(null);

      try {
        const lists = await Promise.all(
          sites.map(async (site) =>
            parseLocationList(await apiRequest(`/api/sites/${site.id}/locations`)),
          ),
        );

        if (!cancelled) {
          setLocations(lists.flatMap((list) => list.locations));
        }
      } catch (caught) {
        if (!cancelled) {
          setLocations([]);
          setLocationsError(asApiError(caught).message);
        }
      } finally {
        if (!cancelled) {
          setLocationsLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [creating, clientSites]);

  function closeAdd() {
    setAdding(false);
    setQuery("");
    setHighlight(0);
    setLinkError(null);
  }

  async function attachAssets(assetIds: string[]) {
    if (assetIds.length === 0 || pending) {
      return;
    }

    setPending(true);
    setLinkError(null);

    try {
      await Promise.all(
        assetIds.map(async (assetId) =>
          parseAssetBody(
            await apiRequest(`/api/assets/${assetId}/projects`, {
              method: "POST",
              body: JSON.stringify({ projectId: project.id }),
            }),
          ),
        ),
      );
      await onChanged();
      closeAdd();
      setCreating(false);
    } catch (caught) {
      setLinkError(asApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  async function attachExisting(assetId: string) {
    const relatedIds = [assetId, ...descendantAssetIds(candidates, assetId)].filter(
      (id) => !linkedIds.has(id),
    );
    await attachAssets(relatedIds);
  }

  async function attachCreated(asset: Asset) {
    await attachAssets([asset.id]);
  }

  const addButton = canEdit ? (
    <SectionAddButton
      label="Add"
      active={adding || creating}
      onClick={() => {
        if (adding || creating) {
          closeAdd();
          setCreating(false);
          return;
        }

        setLinkError(null);
        setAdding(true);
      }}
    />
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {project.assets.length > 0 ? (
        <DataTable columns={["Tag", "Name", "Review"]}>
          {project.assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-gray-50">
              <td className="px-5 py-4 text-sm">
                <Link
                  href={`/projects/${project.id}/assets/${asset.id}`}
                  className="font-medium text-brand-500 hover:underline"
                >
                  {asset.tag}
                </Link>
              </td>
              <td className="px-5 py-4 text-sm font-medium text-gray-800">
                {asset.assetName ?? "—"}
              </td>
              <td className="px-5 py-4 text-sm">
                <ReviewStatusBadge status={asset.reviewStatus} />
              </td>
            </tr>
          ))}
        </DataTable>
      ) : !canEdit && !adding && !creating ? (
        <p className="text-sm text-gray-500">No assets yet.</p>
      ) : null}
      {addButton}
      {adding ? (
        <ExistingPicker
          id={`project-${project.id}-add-asset`}
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            setHighlight(0);
          }}
          highlight={highlight}
          onHighlightChange={setHighlight}
          matches={matches}
          loading={
            (clientSitesRequest.loading && !clientSitesRequest.data) ||
            candidatesLoading
          }
          pending={pending}
          error={
            linkError ??
            candidatesError ??
            (clientSitesRequest.error
              ? asApiError(clientSitesRequest.error).message
              : null)
          }
          placeholder="Search for an asset"
          ariaLabel="Search for an asset to add to this project"
          listLabel="Matching assets"
          emptyLabel="No assets available to link."
          noMatchLabel="No assets match."
          createLabel="Create new asset"
          onCreate={() => {
            closeAdd();
            setCreating(true);
          }}
          onClose={closeAdd}
          onSelect={(item) => {
            void attachExisting(item.id);
          }}
          renderRow={(asset) => (
            <>
              <span className="shrink-0 text-sm font-medium text-brand-500">
                {asset.tag}
              </span>
              <span className="min-w-0 truncate text-sm text-gray-700">
                {asset.assetName ?? "—"}
                {asset.location.name || asset.location.locationCode
                  ? ` · ${asset.location.name ?? asset.location.locationCode}`
                  : ""}
              </span>
            </>
          )}
        />
      ) : null}
      {creating ? (
        <Modal
          title="Add asset"
          onClose={() => {
            setCreating(false);
            setLinkError(null);
            setLocationsError(null);
          }}
        >
          {locationsLoading || (clientSitesRequest.loading && !clientSitesRequest.data) ? (
            <p className="text-sm text-gray-500">Loading locations…</p>
          ) : locationsError || clientSitesRequest.error ? (
            <p className="text-sm text-error-500" role="alert">
              {locationsError ?? asApiError(clientSitesRequest.error!).message}
            </p>
          ) : locations.length === 0 ? (
            <p className="text-sm leading-6 text-gray-700">
              A location is required to add an asset. Add a location for this client
              first, then try again.
            </p>
          ) : (
            <div className="grid gap-3">
              <AssetForm
                locations={locations}
                onCancel={() => {
                  setCreating(false);
                  setLinkError(null);
                }}
                onCreated={(asset) => {
                  void attachCreated(asset);
                }}
              />
              {linkError ? (
                <p className="text-sm text-error-500" role="alert">
                  {linkError}
                </p>
              ) : null}
              {pending ? (
                <p className="text-sm text-gray-500">Adding asset to project…</p>
              ) : null}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

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

function ExistingPicker<T extends { id: string }>({
  id,
  query,
  onQueryChange,
  highlight,
  onHighlightChange,
  matches,
  loading,
  pending,
  error,
  placeholder,
  ariaLabel,
  listLabel,
  emptyLabel,
  noMatchLabel,
  createLabel,
  onCreate,
  onClose,
  onSelect,
  renderRow,
}: {
  id: string;
  query: string;
  onQueryChange: (value: string) => void;
  highlight: number;
  onHighlightChange: (value: number) => void;
  matches: T[];
  loading: boolean;
  pending: boolean;
  error: string | null;
  placeholder: string;
  ariaLabel: string;
  listLabel: string;
  emptyLabel: string;
  noMatchLabel: string;
  createLabel: string;
  onCreate: () => void;
  onClose: () => void;
  onSelect: (item: T) => void;
  renderRow: (item: T) => React.ReactNode;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="relative">
        <ExistingSearchIcon />
        <input
          ref={searchRef}
          id={id}
          type="search"
          value={query}
          disabled={pending || loading}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-controls={`${id}-results`}
          aria-expanded
          role="combobox"
          aria-autocomplete="list"
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onHighlightChange(
                matches.length === 0 ? 0 : (highlight + 1) % matches.length,
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              onHighlightChange(
                matches.length === 0
                  ? 0
                  : (highlight - 1 + matches.length) % matches.length,
              );
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const match = matches[highlight];

              if (match) {
                onSelect(match);
              }

              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          className={`${inputClassName} mt-0 h-9 bg-white pl-9`}
        />
      </div>
      <ul
        id={`${id}-results`}
        role="listbox"
        aria-label={listLabel}
        className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white"
      >
        {loading ? (
          <li className="px-3 py-2 text-sm text-gray-500">Loading…</li>
        ) : matches.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-500">
            {query.trim() ? noMatchLabel : emptyLabel}
          </li>
        ) : (
          matches.map((item, index) => {
            const active = index === highlight;

            return (
              <li key={item.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  disabled={pending}
                  onMouseEnter={() => {
                    onHighlightChange(index);
                  }}
                  onClick={() => {
                    onSelect(item);
                  }}
                  className={`flex w-full items-baseline gap-2 px-3 py-2 text-left ${
                    active ? "bg-brand-50" : "hover:bg-gray-50"
                  }`}
                >
                  {renderRow(item)}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCreate}
          className="text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
        >
          {createLabel}
        </button>
        {error ? (
          <p className="text-sm text-error-500" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ExistingSearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 10.5 13 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function filterByQuery<T>(
  items: T[],
  query: string,
  haystack: (item: T) => string,
): T[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return items;
  }

  return items.filter((item) => haystack(item).toLowerCase().includes(needle));
}

function descendantAssetIds(assets: Asset[], rootId: string): string[] {
  const children = new Map<string, string[]>();

  for (const item of assets) {
    if (!item.parentAssetId) {
      continue;
    }

    const list = children.get(item.parentAssetId) ?? [];
    list.push(item.id);
    children.set(item.parentAssetId, list);
  }

  const ids: string[] = [];
  const stack = [...(children.get(rootId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop()!;
    ids.push(id);
    stack.push(...(children.get(id) ?? []));
  }

  return ids;
}
