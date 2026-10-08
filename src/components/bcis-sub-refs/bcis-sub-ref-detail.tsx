"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { Badge, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { formatBcisRef, parseBcisRefList } from "@/lib/bcis-refs";
import { parseBcisSubRefBody } from "@/lib/bcis-sub-refs";
import {
  BCIS_REFS_VIEW,
  BCIS_SUB_REFS_EDIT,
  BCIS_SUB_REFS_VIEW,
  hasPermission,
} from "@/lib/session";

export function BcisSubRefDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, BCIS_SUB_REFS_VIEW);
  const canEdit = hasPermission(user, BCIS_SUB_REFS_EDIT);
  const canViewRefs = hasPermission(user, BCIS_REFS_VIEW);
  const request = useApi(canView ? `/api/bcis-sub-refs/${id}` : null, parseBcisSubRefBody);
  const refsRequest = useApi(canView && canViewRefs ? "/api/bcis-refs" : null, parseBcisRefList);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/bcis-sub-refs");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (request.loading || (canViewRefs && refsRequest.loading)) {
    return <p className="text-sm text-muted">Loading BCIS sub reference…</p>;
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

  const bcisSubRef = request.data;

  if (!bcisSubRef) {
    return null;
  }

  const parent = refsRequest.data?.find((bcisRef) => bcisRef.id === bcisSubRef.bcisRefId) ?? null;

  return (
    <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">BCIS sub reference</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-800">{bcisSubRef.name}</h1>
          <Detail label="Code" value={bcisSubRef.code} />
          <Detail
            label="BCIS reference"
            value={parent ? formatBcisRef(parent) : bcisSubRef.bcisRefId}
          />
          <div className="mt-3">
            <p className="text-sm text-muted">Description</p>
            <p
              className={`mt-1 text-sm font-medium ${
                bcisSubRef.description ? "leading-6 whitespace-pre-line" : ""
              }`}
            >
              {bcisSubRef.description ?? "—"}
            </p>
          </div>
          <div className="mt-3">
            <p className="text-sm text-muted">Status</p>
            <div className="mt-1">
              <Badge tone={bcisSubRef.isActive ? "success" : "light"}>
                {bcisSubRef.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        {canEdit ? (
          <Link
            href={`/bcis-sub-refs/${bcisSubRef.id}/edit`}
            className={secondaryButtonClassName}
          >
            Edit
          </Link>
        ) : null}
      </div>
    </section>
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
