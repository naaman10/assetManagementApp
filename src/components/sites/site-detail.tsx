"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import { secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseClientBody, type Address } from "@/lib/clients";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import { parseSiteDetail, type SiteDetail } from "@/lib/sites";

export function SiteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const request = useApi(canView ? `/api/sites/${id}` : null, parseSiteDetail);
  const [saved, setSaved] = useState<SiteDetail | null>(null);
  const missing = request.error?.status === 404;
  const site = saved?.id === request.data?.id ? saved : request.data;

  useEffect(() => {
    if (missing) {
      router.replace("/sites");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading site…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {request.error.message}
      </p>
    );
  }

  if (!site) {
    return null;
  }

  const loaded = site;

  async function reloadLogo(): Promise<string | null> {
    try {
      const body = await apiRequest(`/api/clients/${loaded.client.id}`);
      const client = parseClientBody(body);
      setSaved({
        ...loaded,
        client: { ...loaded.client, logoUrl: client.logoUrl },
      });
      return client.logoUrl;
    } catch (error) {
      if (asApiError(error).status === 404) {
        router.replace("/sites");
      }

      throw error;
    }
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <Link
              href={`/clients/${site.client.id}`}
              className="flex w-fit items-center gap-3"
            >
              <ClientLogo
                name={loaded.client.name}
                logoUrl={loaded.client.logoUrl}
                size="list"
                onReload={reloadLogo}
              />
              <span className="font-medium">{site.client.name}</span>
            </Link>
            <p className="mt-6 text-sm text-muted">Site</p>
            <h1 className="mt-1 text-4xl font-medium tracking-tight">{site.name}</h1>
            <p className="mt-3 text-sm leading-6 whitespace-pre-line">
              {formatAddress(site.address)}
            </p>
          </div>
          {canEdit ? (
            <Link href={`/sites/${site.id}/edit`} className={secondaryButtonClassName}>
              Edit
            </Link>
          ) : null}
        </div>
        <p className="mt-8 text-sm text-muted">Contact</p>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailField label="Name" value={site.contact.name} />
          <DetailField label="Role" value={site.contact.role} />
          <DetailField label="Email" value={site.contact.email} />
          <DetailField label="Telephone" value={site.contact.telephone} />
        </dl>
      </section>
    </div>
  );
}

function formatAddress(address: Address): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode,
    address.country,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
