"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuditTable } from "@/components/audits/audit-table";
import { secondaryButtonClassName } from "@/components/form-controls";
import { asApiError, useApi } from "@/lib/api-client";
import { parseAuditList } from "@/lib/audits";

export function ClientAudits({ clientId }: { clientId: string }) {
  const router = useRouter();
  const request = useApi(`/api/clients/${clientId}/audits`, parseAuditList);
  const missing = request.error?.status === 404;
  const audits = request.data?.audits;

  useEffect(() => {
    if (missing) {
      router.replace("/clients");
    }
  }, [missing, router]);

  if (missing) {
    return null;
  }

  return (
    <section>
      <div className="flex justify-end">
        <Link href={`/audits/new?client=${clientId}`} className={secondaryButtonClassName}>
          Create audit
        </Link>
      </div>
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
          <AuditTable audits={audits} includeClient={false} />
        )
      ) : null}
    </section>
  );
}
