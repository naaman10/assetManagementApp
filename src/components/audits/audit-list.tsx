"use client";

import Link from "next/link";
import { AuditTable } from "@/components/audits/audit-table";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseAuditList } from "@/lib/audits";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function AuditList() {
  const { user } = useSession();
  const canCreate = hasPermission(user, CLIENTS_VIEW);
  const request = useApi("/api/audits", parseAuditList);
  const audits = request.data?.audits;

  return (
    <section>
      <PageHeading
        title="Audits"
        action={
          canCreate ? (
            <Link href="/audits/new" className={primaryButtonClassName}>
              Create audit
            </Link>
          ) : null
        }
      />
      {request.loading ? <p className="mt-6 text-sm text-gray-500">Loading audits…</p> : null}
      {request.error ? (
        <p className="mt-6 text-sm text-error-600" role="alert">
          {asApiError(request.error).message}
        </p>
      ) : null}
      {audits && !request.error ? (
        audits.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">No audits yet.</p>
        ) : (
          <AuditTable audits={audits} includeClient />
        )
      ) : null}
    </section>
  );
}
