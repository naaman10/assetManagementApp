"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DataTable } from "@/components/form-controls";
import { asApiError, useApi } from "@/lib/api-client";
import {
  auditStatusLabel,
  formatAuditDate,
  leadLabel,
  parseAuditBody,
} from "@/lib/audits";

export function AuditDetail({ id }: { id: string }) {
  const router = useRouter();
  const request = useApi(`/api/audits/${id}`, parseAuditBody);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/audits");
    }
  }, [missing, router]);

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading audit…</p>;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  const audit = request.data;

  if (!audit) {
    return null;
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <Breadcrumbs
          current
          items={[
            { label: "Audits", href: "/audits" },
            { label: audit.client.name, href: `/clients/${audit.client.id}` },
            { label: audit.title },
          ]}
        />
        <p className="mt-6 text-sm text-gray-500">Audit</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-800">{audit.title}</h1>
        <Detail label="Project reference" value={audit.projectReference} />
        <Detail label="Status" value={auditStatusLabel(audit.status)} />
        <Detail label="Description" value={audit.description ?? "—"} />
        <Detail label="Start date" value={formatAuditDate(audit.startDate)} />
        <Detail label="Due date" value={formatAuditDate(audit.dueDate)} />
        <Detail label="Lead" value={leadLabel(audit.lead)} />
      </section>
      <section>
        {audit.assets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets yet.</p>
        ) : (
          <DataTable columns={["Reference", "Name"]}>
            {audit.assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500">{asset.assetRef}</td>
                <td className="px-5 py-4 text-sm font-medium text-gray-800">
                  {asset.assetName ?? "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <p className="mt-3 text-sm text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium whitespace-pre-line">{value}</p>
    </>
  );
}
