"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientContacts } from "@/components/clients/client-contacts";
import { ClientLogo } from "@/components/clients/client-logo";
import { ClientSettings } from "@/components/clients/client-settings";
import { ClientSites } from "@/components/clients/client-sites";
import { Forbidden } from "@/components/forbidden";
import { secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseClientBody, type Address, type Client } from "@/lib/clients";
import {
  CLIENTS_CREATE,
  CLIENTS_EDIT,
  CLIENTS_VIEW,
  hasPermission,
} from "@/lib/session";

const tabs = [
  { id: "sites", label: "Sites", empty: "No sites yet." },
  { id: "audits", label: "Audits", empty: "No audits yet." },
  { id: "reports", label: "Reports", empty: "No reports yet." },
  { id: "contacts", label: "Contacts", empty: "" },
  { id: "settings", label: "Settings", empty: "" },
] as const;

type ClientTab = (typeof tabs)[number]["id"];

export function ClientEditor({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canCreate = hasPermission(user, CLIENTS_CREATE);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const request = useApi(canView ? `/api/clients/${id}` : null, parseClientBody);
  const [saved, setSaved] = useState<Client | null>(null);
  const [tab, setTab] = useState<ClientTab>("sites");
  const tablistId = useId();
  const missing = request.error?.status === 404;
  const client = saved?.id === request.data?.id ? saved : request.data;

  useEffect(() => {
    if (missing) {
      router.replace("/clients");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading client…</p>;
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

  if (!client) {
    return null;
  }

  async function reloadLogo(): Promise<string | null> {
    try {
      const body = await apiRequest(`/api/clients/${id}`);
      const next = parseClientBody(body);
      setSaved(next);
      return next.logoUrl;
    } catch (error) {
      if (asApiError(error).status === 404) {
        router.replace("/clients");
      }

      throw error;
    }
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-wrap items-center gap-6">
            <ClientLogo
              name={client.name}
              logoUrl={client.logoUrl}
              size="detail"
              onReload={reloadLogo}
            />
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Client</p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-800">{client.name}</h1>
              <p className="mt-3 text-sm text-muted">Reference</p>
              <p className="mt-1 text-sm font-medium">{client.reference ?? "—"}</p>
              <p className="mt-3 text-sm leading-6 whitespace-pre-line">
                {formatAddress(client.address)}
              </p>
            </div>
          </div>
          {canEdit ? (
            <Link
              href={`/clients/${client.id}/edit`}
              className={secondaryButtonClassName}
            >
              Edit
            </Link>
          ) : null}
        </div>
      </section>
      <section>
        <div
          role="tablist"
          aria-label="Client records"
          className="flex flex-wrap gap-6 border-b border-gray-200"
        >
          {tabs.map((item) => {
            const selected = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${tablistId}-${item.id}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-${item.id}-panel`}
                onClick={() => {
                  setTab(item.id);
                }}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
                  selected
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {tabs.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${tablistId}-${item.id}-panel`}
            aria-labelledby={`${tablistId}-${item.id}`}
            hidden={tab !== item.id}
            className="mt-6"
          >
            {item.id === "contacts" ? (
              <ClientContacts
                client={client}
                canEdit={canEdit}
                onClient={setSaved}
                onMissing={() => {
                  router.replace("/clients");
                }}
              />
            ) : item.id === "settings" ? (
              <ClientSettings
                client={client}
                canEdit={canEdit}
                onClient={setSaved}
                onMissing={() => {
                  router.replace("/clients");
                }}
                onShowContacts={() => {
                  setTab("contacts");
                }}
              />
            ) : item.id === "sites" ? (
              <ClientSites
                client={client}
                canCreate={canCreate}
                onClient={setSaved}
                onMissing={() => {
                  router.replace("/clients");
                }}
                onShowContacts={() => {
                  setTab("contacts");
                }}
              />
            ) : (
              <p className="text-sm text-muted">{item.empty}</p>
            )}
          </div>
        ))}
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
