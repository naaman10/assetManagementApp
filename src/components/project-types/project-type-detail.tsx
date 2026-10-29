"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import {
  ConfirmDelete,
  FieldMessages,
  FormBanner,
  bannerMessage,
  secondaryButtonClassName,
} from "@/components/form-controls";
import {
  InlineSelect,
  InlineText,
  InlineTitle,
  Property,
} from "@/components/inline-field";
import { ProjectTypeFields } from "@/components/project-types/project-type-fields";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseProjectTypeBody,
  parseProjectTypeFieldCatalog,
  type ProjectType,
  type ProjectTypeFieldRef,
} from "@/lib/project-types";
import {
  PROJECT_TYPES_DELETE,
  PROJECT_TYPES_EDIT,
  PROJECT_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

export function ProjectTypeDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, PROJECT_TYPES_VIEW);
  const canEdit = hasPermission(user, PROJECT_TYPES_EDIT);
  const canDelete = hasPermission(user, PROJECT_TYPES_DELETE);
  const request = useApi(canView ? `/api/project-types/${id}` : null, parseProjectTypeBody);
  const catalogRequest = useApi(
    canView ? "/api/project-type-field-catalog" : null,
    parseProjectTypeFieldCatalog,
  );
  const missing = request.error?.status === 404;
  const [saved, setSaved] = useState<ProjectType | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const [fieldsPending, setFieldsPending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (missing) {
      router.replace("/project-types");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading project type…</p>;
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

  if (savedFor !== id) {
    setSavedFor(id);
    setSaved(null);
    setDeleteError(null);
  }

  const projectType = saved?.id === request.data?.id ? saved : request.data;

  if (!projectType) {
    return null;
  }

  const loaded = projectType;
  const catalog = catalogRequest.data?.fields ?? [];

  async function saveProjectType(patch: Record<string, unknown>) {
    try {
      const next = parseProjectTypeBody(
        await apiRequest(`/api/project-types/${loaded.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      );
      setSaved(next);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        router.replace("/project-types");
      }

      throw apiError;
    }
  }

  async function saveFields(fields: ProjectTypeFieldRef[]) {
    setFieldsPending(true);

    try {
      await saveProjectType({
        fields: fields.map((field, index) => ({
          source: field.source,
          key: field.key,
          sortOrder: index,
          required: field.required,
        })),
      });
    } finally {
      setFieldsPending(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/project-types/${loaded.id}`, { method: "DELETE" });
      router.push("/project-types");
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/project-types");
        return;
      }

      setDeleteError(apiError.message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Breadcrumbs
        current
        items={[
          { label: "Project types", href: "/project-types" },
          { label: projectType.name },
        ]}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-500">Project type</p>
                <InlineTitle
                  value={projectType.name}
                  editable={canEdit}
                  onSave={async (name) => {
                    if (!name) {
                      throw new ApiRequestError(400, "Invalid request", {
                        name: ["Enter a name."],
                      });
                    }

                    await saveProjectType({ name });
                  }}
                />
                <div className="mt-3 max-w-md">
                  <InlineText
                    label="Code"
                    field="code"
                    value={projectType.code}
                    editable={canEdit}
                    maxLength={100}
                    onSave={async (code) => {
                      const trimmed = code.trim();

                      if (!trimmed) {
                        throw new ApiRequestError(400, "Invalid request", {
                          code: ["Enter a code."],
                        });
                      }

                      await saveProjectType({ code: trimmed });
                    }}
                  />
                </div>
              </div>
              {canEdit ? (
                <Link
                  href={`/project-types/${projectType.id}/edit`}
                  className={secondaryButtonClassName}
                >
                  Edit
                </Link>
              ) : null}
            </div>
          </section>

          <ProjectTypeFields
            projectType={projectType}
            catalog={catalog}
            catalogLoading={catalogRequest.loading && !catalogRequest.data}
            catalogError={
              catalogRequest.error ? asApiError(catalogRequest.error).message : null
            }
            canEdit={canEdit}
            pending={fieldsPending}
            onSaveFields={saveFields}
          />
        </div>

        <aside className="min-w-0 overflow-visible lg:sticky lg:top-24">
          <div className="min-w-0 overflow-visible rounded-card border border-gray-200 bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold text-gray-800">Details</h2>
            <dl className="mt-5 grid grid-cols-1 min-w-0 gap-5 overflow-visible [&>*]:min-w-0">
              <InlineText
                label="Description"
                field="description"
                value={projectType.description ?? ""}
                editable={canEdit}
                maxLength={5000}
                onSave={async (description) => {
                  await saveProjectType({ description: description || null });
                }}
              />
              <InlineSortOrder
                value={projectType.sortOrder}
                editable={canEdit}
                onSave={async (sortOrder) => {
                  await saveProjectType({ sortOrder });
                }}
              />
              {canEdit ? (
                <InlineSelect
                  label="Status"
                  field="isActive"
                  value={projectType.isActive ? "true" : "false"}
                  editable={canEdit}
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                  onSave={async (value) => {
                    await saveProjectType({ isActive: value === "true" });
                  }}
                />
              ) : (
                <Property label="Status">
                  {projectType.isActive ? "Active" : "Inactive"}
                </Property>
              )}
            </dl>
            {canDelete ? (
              <div className="mt-6 grid gap-3 border-t border-gray-200 pt-5">
                {deleteError ? (
                  <p className="text-sm leading-6 text-ink" role="alert">
                    {deleteError}
                  </p>
                ) : null}
                <ConfirmDelete
                  label="Delete project type"
                  question="Delete this project type?"
                  pending={deleting}
                  onConfirm={() => {
                    void remove();
                  }}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function InlineSortOrder({
  value,
  editable,
  onSave,
}: {
  value: number;
  editable: boolean;
  onSave: (value: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);

  async function commit(raw: string) {
    const trimmed = raw.trim();
    const next = Number(trimmed);

    if (!trimmed || !Number.isInteger(next)) {
      setError(
        new ApiRequestError(400, "Invalid request", {
          sortOrder: ["Enter a whole number."],
        }),
      );
      return;
    }

    if (pending || next === value) {
      setEditing(false);
      setError(null);
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
    <Property label="Sort order">
      {editable && editing ? (
        <>
          <input
            aria-label="Sort order"
            type="number"
            step={1}
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
              <FieldMessages messages={error.fieldErrors.sortOrder} />
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
          {value}
        </button>
      ) : (
        <span>{value}</span>
      )}
    </Property>
  );
}
