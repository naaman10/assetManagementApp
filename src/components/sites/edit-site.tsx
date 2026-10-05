"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteForm } from "@/components/sites/site-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { useApi } from "@/lib/api-client";
import { parseClientBody } from "@/lib/clients";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";
import { parseSiteDetail } from "@/lib/sites";

export function EditSite({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canView = hasPermission(user, CLIENTS_VIEW);
  const allowed = canEdit && canView;
  const siteRequest = useApi(allowed ? `/api/sites/${id}` : null, parseSiteDetail);
  const clientId = siteRequest.data?.client.id ?? null;
  const clientRequest = useApi(
    allowed && clientId ? `/api/clients/${clientId}` : null,
    parseClientBody,
  );
  const missing =
    siteRequest.error?.status === 404 || clientRequest.error?.status === 404;
  const waitingForClient =
    clientId !== null && clientRequest.data === null && clientRequest.error === null;

  useEffect(() => {
    if (missing) {
      router.replace("/sites");
    }
  }, [missing, router]);

  if (!canEdit) {
    return <Forbidden />;
  }

  if (!canView) {
    return <Forbidden />;
  }

  if (siteRequest.loading || clientRequest.loading || waitingForClient) {
    return <p className="text-sm text-muted">Loading site…</p>;
  }

  if (siteRequest.error?.status === 403) {
    return <Forbidden message={siteRequest.error.message} />;
  }

  if (siteRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {siteRequest.error.message}
      </p>
    );
  }

  if (clientRequest.error?.status === 403) {
    return <Forbidden message={clientRequest.error.message} />;
  }

  if (clientRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {clientRequest.error.message}
      </p>
    );
  }

  const site = siteRequest.data;
  const client = clientRequest.data;

  if (!site || !client) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit site"
        action={
          <Link href={`/sites/${site.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <SiteForm
        key={site.id}
        className="mt-8 grid gap-5"
        clientId={client.id}
        site={site}
        contacts={client.contacts}
        onMissing={() => {
          router.replace("/sites");
        }}
        onSaved={() => {
          router.push(`/sites/${site.id}`);
        }}
      />
    </section>
  );
}
