"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BcisSubRefForm } from "@/components/bcis-sub-refs/bcis-sub-ref-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseBcisRefList } from "@/lib/bcis-refs";
import { parseBcisSubRefBody } from "@/lib/bcis-sub-refs";
import { BCIS_SUB_REFS_EDIT, hasPermission } from "@/lib/session";

export function EditBcisSubRef({ id }: { id: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canEdit = hasPermission(user, BCIS_SUB_REFS_EDIT);
  const request = useApi(canEdit ? `/api/bcis-sub-refs/${id}` : null, parseBcisSubRefBody);
  const refsRequest = useApi(canEdit ? "/api/bcis-refs" : null, parseBcisRefList);
  const missing = request.error?.status === 404;
  const forbidden =
    request.error?.status === 403
      ? request.error
      : refsRequest.error?.status === 403
        ? refsRequest.error
        : null;
  const error = request.error ?? refsRequest.error;

  useEffect(() => {
    if (missing) {
      router.replace("/bcis-sub-refs");
    }
  }, [missing, router]);

  if (!canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (missing) {
    return null;
  }

  if (request.loading || refsRequest.loading) {
    return <p className="text-sm text-muted">Loading BCIS sub reference…</p>;
  }

  if (forbidden) {
    return <Forbidden message={forbidden.message} />;
  }

  if (error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(error).message}
      </p>
    );
  }

  const bcisSubRef = request.data;
  const bcisRefs = refsRequest.data;

  if (!bcisSubRef || !bcisRefs) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit BCIS sub reference"
        action={
          <Link href={`/bcis-sub-refs/${bcisSubRef.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <BcisSubRefForm
        key={bcisSubRef.id}
        bcisSubRef={bcisSubRef}
        bcisRefs={bcisRefs}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
