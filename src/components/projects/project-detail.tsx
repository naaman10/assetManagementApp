"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  FieldMessages,
  FormBanner,
  bannerMessage,
} from "@/components/form-controls";
import { InlineSelect, InlineText, InlineTitle, Property } from "@/components/inline-field";
import { ProjectAssetsSection } from "@/components/projects/project-assets";
import { ProjectSitesTree } from "@/components/projects/project-sites-tree";
import { UserMultiPicker } from "@/components/projects/user-multi-picker";
import { useSession } from "@/components/session-provider";
import { StatusToolbar } from "@/components/status-toolbar";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseProjectTypeList } from "@/lib/project-types";
import {
  PROJECT_STATUSES,
  countProjectLocations,
  formatProjectDate,
  leadLabel,
  parseLeadUsers,
  parseProjectBody,
  projectStatusLabel,
  type Project,
  type ProjectStatus,
  type ProjectUser,
} from "@/lib/projects";
import {
  CLIENTS_EDIT,
  CLIENTS_VIEW,
  PROJECT_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

const tabs = [
  { id: "locations", label: "Locations" },
  { id: "assets", label: "Assets" },
] as const;

type ProjectTab = (typeof tabs)[number]["id"];

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const tablistId = useId();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canPickTypes = hasPermission(user, PROJECT_TYPES_VIEW);
  const request = useApi(canView ? `/api/projects/${id}` : null, parseProjectBody);
  const typesRequest = useApi(canPickTypes ? "/api/project-types" : null, parseProjectTypeList);
  const usersRequest = useApi(canEdit ? "/api/clients/users" : null, parseLeadUsers);
  const [saved, setSaved] = useState<Project | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const [tab, setTab] = useState<ProjectTab>("locations");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [membersKey, setMembersKey] = useState("");
  const [memberError, setMemberError] = useState<ApiRequestError | null>(null);
  const [memberPending, setMemberPending] = useState(false);
  const [leadError, setLeadError] = useState<ApiRequestError | null>(null);
  const [leadPending, setLeadPending] = useState(false);
  const missing = request.error?.status === 404;
  const hideUsers = usersRequest.error?.status === 403;

  useEffect(() => {
    if (missing) {
      router.replace("/projects");
    }
  }, [missing, router]);

  if (!canView) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        You do not have access to this project.
      </p>
    );
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading project…</p>;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  if (savedFor !== id) {
    setSavedFor(id);
    setSaved(null);
    setTab("locations");
    setMembersKey("");
    setMemberIds([]);
    setMemberError(null);
    setLeadError(null);
  }

  const project = saved?.id === request.data?.id ? saved : request.data;

  if (!project) {
    return null;
  }

  const loaded = project;
  const locationCount = countProjectLocations(project.sites);
  const nextMembersKey = project.members.map((member) => member.id).sort().join(",");

  if (membersKey !== nextMembersKey) {
    setMembersKey(nextMembersKey);
    setMemberIds(project.members.map((member) => member.id));
  }

  const catalogUsers = usersRequest.data ?? [];
  const people = mergePeople(catalogUsers, project.lead, project.members);
  const typeOptions = (typesRequest.data ?? [])
    .filter((type) => type.isActive || type.id === project.projectTypeId)
    .map((type) => ({
      value: type.id,
      label: `${type.name} (${type.code})`,
    }));

  if (
    typeOptions.length > 0 &&
    !typeOptions.some((option) => option.value === project.projectTypeId)
  ) {
    typeOptions.unshift({
      value: project.projectTypeId,
      label: `${project.projectType.name} (${project.projectType.code})`,
    });
  }

  async function saveProject(patch: Record<string, unknown>) {
    try {
      const next = parseProjectBody(
        await apiRequest(`/api/projects/${loaded.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      );
      setSaved(next);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        router.replace("/projects");
      }

      throw apiError;
    }
  }

  async function saveMembers(ids: string[]) {
    setMemberIds(ids);
    setMemberPending(true);
    setMemberError(null);

    try {
      await saveProject({ memberIds: ids });
    } catch (caught) {
      setMemberIds(loaded.members.map((member) => member.id));
      setMemberError(asApiError(caught));
    } finally {
      setMemberPending(false);
    }
  }

  async function saveLead(leadUserId: string) {
    setLeadPending(true);
    setLeadError(null);

    try {
      await saveProject({ leadUserId: leadUserId || null });
    } catch (caught) {
      setLeadError(asApiError(caught));
    } finally {
      setLeadPending(false);
    }
  }

  const statusToolbar = (
    <StatusToolbar
      value={project.status}
      editable={canEdit}
      highlightValues={["in_progress"]}
      options={PROJECT_STATUSES.map((status) => ({
        value: status,
        label: projectStatusLabel(status),
      }))}
      onChange={async (status) => {
        await saveProject({ status: status as ProjectStatus });
      }}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Breadcrumbs
        current
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.client.name, href: `/clients/${project.client.id}` },
          { label: project.title },
        ]}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <p className="text-sm text-gray-500">Project</p>
            <InlineTitle
              value={project.title}
              field="title"
              maxLength={255}
              editable={canEdit}
              onSave={async (title) => {
                if (!title) {
                  throw new ApiRequestError(400, "Invalid request", {
                    title: ["Enter a title."],
                  });
                }

                await saveProject({ title });
              }}
            />
            <div className="mt-3 max-w-md">
              <InlineText
                label="Reference"
                field="projectReference"
                value={project.projectReference}
                editable={canEdit}
                maxLength={100}
                onSave={async (projectReference) => {
                  if (!projectReference) {
                    throw new ApiRequestError(400, "Invalid request", {
                      projectReference: ["Enter a project reference."],
                    });
                  }

                  await saveProject({ projectReference });
                }}
              />
            </div>
            <div className="mt-4 lg:hidden">{statusToolbar}</div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
              <h2 className="text-sm font-semibold text-gray-800">Description</h2>
            </div>
            <div className="mt-4">
              <InlineText
                label="Description"
                field="description"
                value={project.description ?? ""}
                editable={canEdit}
                maxLength={5000}
                onSave={async (description) => {
                  await saveProject({ description: description || null });
                }}
              />
            </div>
          </section>

          <section>
            <div
              role="tablist"
              aria-label="Project records"
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
                      {item.id === "locations" ? locationCount : project.assets.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              role="tabpanel"
              id={`${tablistId}-locations-panel`}
              aria-labelledby={`${tablistId}-locations`}
              hidden={tab !== "locations"}
              className="mt-6"
            >
              <ProjectSitesTree sites={project.sites} />
            </div>
            <div
              role="tabpanel"
              id={`${tablistId}-assets-panel`}
              aria-labelledby={`${tablistId}-assets`}
              hidden={tab !== "assets"}
              className="mt-6"
            >
              <ProjectAssetsSection
                project={project}
                canEdit={canEdit}
                onChanged={async () => {
                  const next = parseProjectBody(
                    await apiRequest(`/api/projects/${loaded.id}`),
                  );
                  setSaved(next);
                }}
              />
            </div>
          </section>
        </div>

        <aside className="min-w-0 overflow-visible lg:sticky lg:top-24">
          <div className="hidden lg:block">{statusToolbar}</div>
          <div className="min-w-0 overflow-visible rounded-card border border-gray-200 bg-surface p-5 shadow-card lg:mt-4">
            <h2 className="text-sm font-semibold text-gray-800">Details</h2>
            <dl className="mt-5 grid min-w-0 gap-5 overflow-visible [&>*]:min-w-0">
              {canEdit && canPickTypes ? (
                <InlineSelect
                  label="Type"
                  field="projectTypeId"
                  value={project.projectTypeId}
                  editable={canEdit && canPickTypes}
                  options={
                    typeOptions.length > 0
                      ? typeOptions
                      : [
                          {
                            value: project.projectTypeId,
                            label: `${project.projectType.name} (${project.projectType.code})`,
                          },
                        ]
                  }
                  onSave={async (projectTypeId) => {
                    await saveProject({ projectTypeId });
                  }}
                />
              ) : (
                <Property label="Type">{project.projectType.name}</Property>
              )}
              <Property label="Client">
                <Link
                  href={`/clients/${project.client.id}`}
                  className="text-brand-500 hover:underline"
                >
                  {project.client.name}
                </Link>
              </Property>
              <Property label="Lead">
                {canEdit && !hideUsers ? (
                  <>
                    <AssetTypePicker
                      id={`project-${project.id}-lead`}
                      types={people.map((person) => ({
                        id: person.id,
                        name: person.name ?? person.email,
                        code: "",
                      }))}
                      value={project.lead?.id ?? ""}
                      disabled={leadPending}
                      loading={usersRequest.loading}
                      showCode={false}
                      inlineMenu
                      clearLabel="No lead"
                      listLabel="People"
                      placeholder="Choose a lead"
                      searchPlaceholder="Search people"
                      loadingLabel="Loading people…"
                      onChange={(leadUserId) => {
                        void saveLead(leadUserId);
                      }}
                    />
                    {usersRequest.error && usersRequest.error.status !== 403 ? (
                      <p className="mt-1.5 text-sm text-error-500" role="alert">
                        {usersRequest.error.message}
                      </p>
                    ) : null}
                    {leadError ? (
                      <>
                        <FormBanner
                          message={bannerMessage(leadError.message, leadError.fieldErrors)}
                        />
                        <FieldMessages messages={leadError.fieldErrors.leadUserId} />
                      </>
                    ) : null}
                  </>
                ) : (
                  leadLabel(project.lead)
                )}
              </Property>
              <Property label="Members">
                {canEdit && !hideUsers ? (
                  <>
                    <UserMultiPicker
                      id={`project-${project.id}-members`}
                      users={people}
                      value={memberIds}
                      disabled={memberPending}
                      loading={usersRequest.loading}
                      onChange={(ids) => {
                        void saveMembers(ids);
                      }}
                    />
                    {usersRequest.error && usersRequest.error.status !== 403 ? (
                      <p className="mt-1.5 text-sm text-error-500" role="alert">
                        {usersRequest.error.message}
                      </p>
                    ) : null}
                    {memberError ? (
                      <>
                        <FormBanner
                          message={bannerMessage(memberError.message, memberError.fieldErrors)}
                        />
                        <FieldMessages messages={memberError.fieldErrors.memberIds} />
                      </>
                    ) : null}
                  </>
                ) : project.members.length === 0 ? (
                  "—"
                ) : (
                  <ul className="grid gap-1">
                    {project.members.map((member) => (
                      <li key={member.id}>{leadLabel(member)}</li>
                    ))}
                  </ul>
                )}
              </Property>
              <InlineDate
                label="Start date"
                field="startDate"
                value={project.startDate ?? ""}
                editable={canEdit}
                onSave={async (startDate) => {
                  await saveProject({ startDate: startDate || null });
                }}
              />
              <InlineDate
                label="Due date"
                field="dueDate"
                value={project.dueDate ?? ""}
                editable={canEdit}
                onSave={async (dueDate) => {
                  await saveProject({ dueDate: dueDate || null });
                }}
              />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InlineDate({
  label,
  field,
  value,
  editable,
  onSave,
}: {
  label: string;
  field: string;
  value: string;
  editable: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const display = formatProjectDate(value || null);

  async function commit(next: string) {
    if (pending || next === value) {
      setEditing(false);
      return;
    }

    setPending(true);
    setError(null);

    try {
      await onSave(next);
      setEditing(false);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Property label={label}>
      {editable && editing ? (
        <>
          <input
            aria-label={label}
            type="date"
            autoFocus
            defaultValue={value}
            disabled={pending}
            className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setEditing(false);
                setError(null);
              }

              if (event.key === "Enter") {
                event.preventDefault();
                void commit(event.currentTarget.value);
              }
            }}
            onBlur={(event) => {
              void commit(event.currentTarget.value);
            }}
          />
          {error ? (
            <>
              <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
              <FieldMessages messages={error.fieldErrors[field]} />
            </>
          ) : null}
        </>
      ) : editable ? (
        <button
          type="button"
          className="-mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left hover:bg-gray-50"
          onClick={() => {
            setEditing(true);
            setError(null);
          }}
        >
          {display}
        </button>
      ) : (
        <span>{display}</span>
      )}
    </Property>
  );
}

function mergePeople(
  catalog: ProjectUser[],
  lead: ProjectUser | null,
  members: ProjectUser[],
): ProjectUser[] {
  const byId = new Map(catalog.map((person) => [person.id, person]));

  for (const person of [...(lead ? [lead] : []), ...members]) {
    if (!byId.has(person.id)) {
      byId.set(person.id, person);
    }
  }

  return [...byId.values()].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );
}
