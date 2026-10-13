"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { Badge, ConfirmDelete, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseProjectTypeBody } from "@/lib/project-types";
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
  const missing = request.error?.status === 404;
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

  const projectType = request.data;

  if (!projectType) {
    return null;
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/project-types/${id}`, { method: "DELETE" });
      router.push("/project-types");
    } catch (error) {
      setDeleteError(asApiError(error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Project type</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-800">{projectType.name}</h1>
            <Detail label="Code" value={projectType.code} />
            <Detail label="Sort order" value={String(projectType.sortOrder)} />
            <div className="mt-3">
              <p className="text-sm text-muted">Description</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  projectType.description ? "leading-6 whitespace-pre-line" : ""
                }`}
              >
                {projectType.description ?? "—"}
              </p>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted">Status</p>
              <div className="mt-1">
                <Badge tone={projectType.isActive ? "success" : "light"}>
                  {projectType.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
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
      {canDelete ? (
        <div className="grid gap-3">
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
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
