"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { Badge, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseBcisRefBody } from "@/lib/bcis-refs";
import { BCIS_REFS_EDIT, BCIS_REFS_VIEW, hasPermission } from "@/lib/session";

export function BcisRefDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, BCIS_REFS_VIEW);
  const canEdit = hasPermission(user, BCIS_REFS_EDIT);
  const request = useApi(canView ? `/api/bcis-refs/${id}` : null, parseBcisRefBody);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/bcis-refs");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading BCIS reference…</p>;
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

  const bcisRef = request.data;

  if (!bcisRef) {
    return null;
  }

  return (
    <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">BCIS reference</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-800">{bcisRef.name}</h1>
          <Detail label="Code" value={bcisRef.code} />
          <div className="mt-3">
            <p className="text-sm text-muted">Description</p>
            <p
              className={`mt-1 text-sm font-medium ${
                bcisRef.description ? "leading-6 whitespace-pre-line" : ""
              }`}
            >
              {bcisRef.description ?? "—"}
            </p>
          </div>
          <div className="mt-3">
            <p className="text-sm text-muted">Status</p>
            <div className="mt-1">
              <Badge tone={bcisRef.isActive ? "success" : "light"}>
                {bcisRef.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        {canEdit ? (
          <Link href={`/bcis-refs/${bcisRef.id}/edit`} className={secondaryButtonClassName}>
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
