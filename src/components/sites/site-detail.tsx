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
import { parseSiteDetail, type SiteContact as Contact, type SiteDetail } from "@/lib/sites";

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
    <div className="grid gap-8">
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
            <p className="mt-6 text-sm text-gray-500">Site</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-800">{site.name}</h1>
            <p className="mt-3 text-sm text-muted">Reference</p>
            <p className="mt-1 text-sm font-medium">{site.reference ?? "—"}</p>
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
        <SiteContact contact={site.contact} />
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

function SiteContact({ contact }: { contact: Contact }) {
  const email = mailtoHref(contact.email);
  const telephone = telHref(contact.telephone);

  return (
    <div className="mt-8 inline-flex max-w-full items-center gap-4 rounded-2xl border border-line px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{contact.name}</p>
        {contact.role ? (
          <p className="mt-1 truncate text-sm text-muted">{contact.role}</p>
        ) : null}
      </div>
      {email || telephone ? (
        <div className="flex shrink-0 gap-2">
          {email ? (
            <a
              href={email}
              aria-label={`Email ${contact.name}`}
              title={contact.email ?? undefined}
              className="flex size-10 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <MailIcon />
            </a>
          ) : null}
          {telephone ? (
            <a
              href={telephone}
              aria-label={`Call ${contact.name}`}
              title={contact.telephone ?? undefined}
              className="flex size-10 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <PhoneIcon />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function mailtoHref(email: string | null): string | null {
  const value = email?.trim() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return null;
  }

  return `mailto:${value}`;
}

function telHref(telephone: string | null): string | null {
  const value = telephone?.trim() ?? "";

  if (!/^[+0-9().\s-]{3,}$/.test(value)) {
    return null;
  }

  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2.5 4.5 8 8.5 13.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M5.2 2.8h1.1c.4 0 .7.2.8.6l.5 1.5a.8.8 0 0 1-.4 1l-.9.4a6.4 6.4 0 0 0 3.4 3.4l.4-.9a.8.8 0 0 1 1-.4l1.5.5c.4.1.6.4.6.8v1.1c0 .5-.4.9-.9.9-5.2.6-8.8-3-8.2-8.2 0-.5.4-.9.9-.9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
