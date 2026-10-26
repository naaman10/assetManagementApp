"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DataTable } from "@/components/form-controls";
import { InlineText, InlineTitle, Property } from "@/components/inline-field";
import { useSession } from "@/components/session-provider";
import { StatusToolbar } from "@/components/status-toolbar";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  PROJECT_STATUSES,
  formatProjectDate,
  leadLabel,
  parseProjectBody,
  projectStatusLabel,
  type Project,
  type ProjectStatus,
} from "@/lib/projects";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const request = useApi(canView ? `/api/projects/${id}` : null, parseProjectBody);
  const [saved, setSaved] = useState<Project | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const missing = request.error?.status === 404;

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
  }

  const project = saved?.id === request.data?.id ? saved : request.data;

  if (!project) {
    return null;
  }

  const loaded = project;

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
    <div className="grid min-w-0 gap-8">
      <Breadcrumbs
        current
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.client.name, href: `/clients/${project.client.id}` },
          { label: project.title },
        ]}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="grid min-w-0 gap-8">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-2">
              <h2 className="text-sm font-semibold text-gray-800">
                Assets
                <span className="ml-2 font-medium text-gray-500">
                  {project.assets.length}
                </span>
              </h2>
            </div>
            <div className="mt-4">
              {project.assets.length === 0 ? (
                <p className="text-sm text-gray-500">No assets yet.</p>
              ) : (
                <DataTable columns={["Tag", "Name"]}>
                  {project.assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 text-sm">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-medium text-brand-500 hover:underline"
                        >
                          {asset.tag}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-800">
                        {asset.assetName ?? "—"}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 overflow-visible lg:sticky lg:top-24">
          <div className="hidden lg:block">{statusToolbar}</div>
          <div className="min-w-0 overflow-visible rounded-card border border-gray-200 bg-surface p-5 shadow-card lg:mt-4">
            <h2 className="text-sm font-semibold text-gray-800">Details</h2>
            <dl className="mt-5 grid min-w-0 gap-5 overflow-visible [&>*]:min-w-0">
              <Property label="Type">{project.projectType.name}</Property>
              <Property label="Client">
                <Link
                  href={`/clients/${project.client.id}`}
                  className="text-brand-500 hover:underline"
                >
                  {project.client.name}
                </Link>
              </Property>
              <Property label="Lead">{leadLabel(project.lead)}</Property>
              <Property label="Members">
                {project.members.length === 0 ? (
                  "—"
                ) : (
                  <ul className="grid gap-1">
                    {project.members.map((member) => (
                      <li key={member.id}>{leadLabel(member)}</li>
                    ))}
                  </ul>
                )}
              </Property>
              <Property label="Start date">{formatProjectDate(project.startDate)}</Property>
              <Property label="Due date">{formatProjectDate(project.dueDate)}</Property>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
