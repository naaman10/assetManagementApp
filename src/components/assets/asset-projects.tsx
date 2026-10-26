"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, inputClassName } from "@/components/form-controls";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  PROJECT_STATUSES,
  parseProjectList,
  projectStatusLabel,
  type Project,
  type ProjectStatus,
} from "@/lib/projects";
import { parseAssetBody, type Asset } from "@/lib/sites";

export function AssetProjectsSection({
  asset,
  siteAssets,
  canEdit,
  onAsset,
}: {
  asset: Asset;
  siteAssets: Asset[];
  canEdit: boolean;
  onAsset: (asset: Asset) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const projectsRequest = useApi(
    canEdit && adding ? `/api/clients/${asset.client.id}/projects` : null,
    parseProjectList,
  );
  const linkedIds = new Set(asset.projects.map((project) => project.id));
  const candidates = (projectsRequest.data?.projects ?? []).filter(
    (project) => !linkedIds.has(project.id),
  );
  const matches = filterProjectCandidates(candidates, query);
  const relatedAssetIds = [asset.id, ...descendantAssetIds(siteAssets, asset.id)];

  useEffect(() => {
    if (adding) {
      searchRef.current?.focus();
    }
  }, [adding]);

  function closeAdd() {
    setAdding(false);
    setQuery("");
    setHighlight(0);
    setActionError(null);
  }

  async function attachProject(projectId: string) {
    if (!projectId || pending) {
      return;
    }

    setPending(true);
    setActionError(null);

    try {
      const results = await Promise.all(
        relatedAssetIds.map(async (assetId) =>
          parseAssetBody(
            await apiRequest(`/api/assets/${assetId}/projects`, {
              method: "POST",
              body: JSON.stringify({ projectId }),
            }),
          ),
        ),
      );
      const next = results.find((item) => item.id === asset.id) ?? results[0];
      onAsset(next);
      closeAdd();
    } catch (caught) {
      setActionError(asApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  async function removeProject(projectId: string) {
    if (pending || removingId) {
      return;
    }

    setRemovingId(projectId);
    setActionError(null);

    try {
      await apiRequest(`/api/assets/${asset.id}/projects/${projectId}`, {
        method: "DELETE",
      });
      onAsset({
        ...asset,
        projects: asset.projects.filter((project) => project.id !== projectId),
      });
    } catch (caught) {
      setActionError(asApiError(caught).message);
    } finally {
      setRemovingId(null);
    }
  }

  const addButton = canEdit ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (adding) {
          closeAdd();
          return;
        }

        setActionError(null);
        setAdding(true);
      }}
      className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
    >
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      {adding ? "Cancel" : "Add to project"}
    </button>
  ) : null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="border-b border-gray-200 pb-2">
        <h2 className="text-sm font-semibold text-gray-800">
          Projects
          {asset.projects.length > 0 ? (
            <span className="ml-2 font-medium text-gray-500">{asset.projects.length}</span>
          ) : null}
        </h2>
      </div>
      {asset.projects.length === 0 ? (
        !canEdit ? (
          <p className="text-sm text-gray-500">Not included in any projects.</p>
        ) : null
      ) : (
        <ul className="grid gap-0.5">
          {asset.projects.map((project) => (
            <li key={project.id}>
              <div className="flex min-w-0 items-start justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-gray-50">
                <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-800 hover:underline">
                    {project.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{project.projectReference}</span>
                    <Badge tone={project.status === "in_progress" ? "success" : "light"}>
                      {statusLabel(project.status)}
                    </Badge>
                    <span>{project.projectType.name}</span>
                  </span>
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending || removingId === project.id}
                    className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
                    onClick={() => {
                      void removeProject(project.id);
                    }}
                  >
                    {removingId === project.id ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {addButton ? <div>{addButton}</div> : null}
      {adding ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="relative">
            <SearchIcon />
            <input
              ref={searchRef}
              id={`asset-${asset.id}-add-project`}
              type="search"
              value={query}
              disabled={pending || projectsRequest.loading}
              placeholder="Search for a project"
              autoComplete="off"
              aria-label="Search for a project to include this asset"
              aria-controls={`asset-${asset.id}-add-project-results`}
              aria-expanded
              role="combobox"
              aria-autocomplete="list"
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlight((current) =>
                    matches.length === 0 ? 0 : (current + 1) % matches.length,
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlight((current) =>
                    matches.length === 0
                      ? 0
                      : (current - 1 + matches.length) % matches.length,
                  );
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  const match = matches[highlight];

                  if (match) {
                    void attachProject(match.id);
                  }

                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  closeAdd();
                }
              }}
              className={`${inputClassName} mt-0 h-9 bg-white pl-9`}
            />
          </div>
          <ul
            id={`asset-${asset.id}-add-project-results`}
            role="listbox"
            aria-label="Matching projects"
            className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white"
          >
            {projectsRequest.loading ? (
              <li className="px-3 py-2 text-sm text-gray-500">Loading projects…</li>
            ) : projectsRequest.error ? (
              <li className="px-3 py-2 text-sm text-error-500" role="alert">
                {asApiError(projectsRequest.error).message}
              </li>
            ) : matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                {candidates.length === 0
                  ? "No other projects available."
                  : "No projects match."}
              </li>
            ) : (
              matches.map((project, index) => {
                const active = index === highlight;

                return (
                  <li key={project.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      disabled={pending}
                      onMouseEnter={() => {
                        setHighlight(index);
                      }}
                      onClick={() => {
                        void attachProject(project.id);
                      }}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
                        active ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-800">{project.title}</span>
                      <span className="text-xs text-gray-500">
                        {projectSecondary(project)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
      {actionError ? (
        <p className="text-sm text-error-500" role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
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

function filterProjectCandidates(candidates: Project[], query: string): Project[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return candidates;
  }

  return candidates.filter(
    (project) =>
      project.title.toLowerCase().includes(needle) ||
      project.projectReference.toLowerCase().includes(needle) ||
      project.projectType.name.toLowerCase().includes(needle) ||
      project.projectType.code.toLowerCase().includes(needle) ||
      statusLabel(project.status).toLowerCase().includes(needle),
  );
}

function projectSecondary(project: Project): string {
  return [
    project.projectReference,
    project.projectType.name,
    statusLabel(project.status),
  ].join(" · ");
}

function statusLabel(status: string): string {
  if ((PROJECT_STATUSES as readonly string[]).includes(status)) {
    return projectStatusLabel(status as ProjectStatus);
  }

  return status;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
