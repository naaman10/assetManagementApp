"use client";

import { useState } from "react";
import { BcisSubRefForm } from "@/components/bcis-sub-refs/bcis-sub-ref-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseBcisRefList } from "@/lib/bcis-refs";
import { BCIS_SUB_REFS_CREATE, hasPermission } from "@/lib/session";

export function CreateBcisSubRef() {
  const { user } = useSession();
  const [denied, setDenied] = useState<string | null>(null);
  const canCreate = hasPermission(user, BCIS_SUB_REFS_CREATE);
  const refsRequest = useApi(canCreate ? "/api/bcis-refs" : null, parseBcisRefList);

  if (!canCreate || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (refsRequest.loading) {
    return <p className="text-sm text-muted">Loading BCIS references…</p>;
  }

  if (refsRequest.error?.status === 403) {
    return <Forbidden message={refsRequest.error.message} />;
  }

  if (refsRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(refsRequest.error).message}
      </p>
    );
  }

  if (!refsRequest.data) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading title="New BCIS sub reference" />
      <BcisSubRefForm
        bcisRefs={refsRequest.data}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
