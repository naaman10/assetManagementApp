"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { ConfirmDelete, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { nrm3Label, parseNrm3ClassificationBody } from "@/lib/nrm3-classifications";
import {
  NRM3_CLASSIFICATIONS_DELETE,
  NRM3_CLASSIFICATIONS_EDIT,
  NRM3_CLASSIFICATIONS_VIEW,
  hasPermission,
} from "@/lib/session";

export function Nrm3ClassificationDetail({ code }: { code: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, NRM3_CLASSIFICATIONS_VIEW);
  const canEdit = hasPermission(user, NRM3_CLASSIFICATIONS_EDIT);
  const canDelete = hasPermission(user, NRM3_CLASSIFICATIONS_DELETE);
  const encoded = encodeURIComponent(code);
  const request = useApi(
    canView ? `/api/nrm3-classifications/${encoded}` : null,
    parseNrm3ClassificationBody,
  );
  const missing = request.error?.status === 404;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (missing) {
      router.replace("/nrm3-classifications");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading classification…</p>;
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

  const classification = request.data;

  if (!classification) {
    return null;
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/nrm3-classifications/${encoded}`, { method: "DELETE" });
      router.push("/nrm3-classifications");
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
            <p className="text-sm text-gray-500">NRM3 classification</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-800">
              {nrm3Label(classification)}
            </h1>
            <Detail label="Code" value={classification.code} />
            <Detail label="Name" value={classification.name} />
            <Detail label="Level" value={String(classification.level)} />
            <Detail label="Parent" value={classification.parentCode ?? "—"} />
            <Detail
              label="Maintainable asset description"
              value={classification.maintainableAssetDescription ?? "—"}
            />
            <Detail label="Renewal UOM" value={classification.renewalUom ?? "—"} />
            <Detail label="Maintenance UOM" value={classification.maintenanceUom ?? "—"} />
            <Detail
              label="Product / material type"
              value={classification.productMaterialType ?? "—"}
            />
            <Detail label="Work package" value={classification.workPackage ?? "—"} />
            <Detail label="Source version" value={classification.sourceVersion} />
            <Detail
              label="Source row"
              value={
                classification.sourceRow == null ? "—" : String(classification.sourceRow)
              }
            />
          </div>
          {canEdit ? (
            <Link
              href={`/nrm3-classifications/${encoded}/edit`}
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
            label="Delete classification"
            question="Delete this NRM3 classification?"
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
