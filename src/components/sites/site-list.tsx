"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import { PageHeading } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import {
  apiRequest,
  asApiError,
  useApi,
  type ApiRequestError,
} from "@/lib/api-client";
import { parseClientBody, parseClientList, type Client } from "@/lib/clients";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";
import type { SiteDetail } from "@/lib/sites";

export function SiteList() {
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const request = useApi(canView ? "/api/clients" : null, parseClientList);
  const [rows, setRows] = useState<SiteDetail[] | null>(null);
  const [rowsFrom, setRowsFrom] = useState<Client[] | null>(null);
  const [detailsError, setDetailsError] = useState<ApiRequestError | null>(null);

  if (request.data !== rowsFrom) {
    setRowsFrom(request.data);
    setRows(request.data?.length === 0 ? [] : null);
    setDetailsError(null);
  }

  useEffect(() => {
    if (!request.data || request.data.length === 0) {
      return;
    }

    let cancelled = false;

    loadSites(request.data)
      .then((sites) => {
        if (!cancelled) {
          setRows(sites);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setDetailsError(asApiError(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [request.data]);

  if (!canView) {
    return <Forbidden />;
  }

  const error = request.error ?? detailsError;
  const loading =
    request.loading ||
    (request.data !== null && rows === null && detailsError === null);

  async function refreshLogo(clientId: string): Promise<string | null> {
    const body = await apiRequest(`/api/clients/${clientId}`);
    const next = parseClientBody(body);
    setRows((current) =>
      current?.map((site) =>
        site.client.id === next.id
          ? { ...site, client: { ...site.client, logoUrl: next.logoUrl } }
          : site,
      ) ?? current,
    );
    return next.logoUrl;
  }

  return (
    <section>
      <PageHeading title="Sites" />
      {loading ? <p className="mt-8 text-sm text-muted">Loading sites…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-8 text-sm leading-6 text-ink" role="alert">
            {error.message}
          </p>
        )
      ) : null}
      {rows && !error ? (
        <SiteRows
          sites={rows}
          onReload={async (clientId) => {
            try {
              return await refreshLogo(clientId);
            } catch (caught) {
              if (asApiError(caught).status === 404) {
                setRows(
                  (current) =>
                    current?.filter((site) => site.client.id !== clientId) ?? current,
                );
                return null;
              }

              throw caught;
            }
          }}
        />
      ) : null}
    </section>
  );
}

function SiteRows({
  sites,
  onReload,
}: {
  sites: SiteDetail[];
  onReload: (clientId: string) => Promise<string | null>;
}) {
  if (sites.length === 0) {
    return <p className="mt-8 text-sm text-muted">No sites yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
      {sites.map((site) => (
        <li key={site.id}>
          <Link href={`/sites/${site.id}`} className="flex items-center gap-4 px-6 py-4">
            <ClientLogo
              name={site.client.name}
              logoUrl={site.client.logoUrl}
              size="list"
              onReload={() => onReload(site.client.id)}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{site.name}</span>
              <span className="mt-1 block truncate text-sm text-muted">
                {site.client.name}
                {" · "}
                {site.address.city}
                {" · "}
                {site.address.postcode}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function loadSites(clients: Client[]): Promise<SiteDetail[]> {
  const details = await Promise.all(
    clients.map(async (client) => {
      try {
        return parseClientBody(await apiRequest(`/api/clients/${client.id}`));
      } catch (caught) {
        const error = asApiError(caught);

        if (error.status === 404) {
          return null;
        }

        throw error;
      }
    }),
  );

  return details
    .flatMap((client) => {
      if (!client) {
        return [];
      }

      return client.sites.map((site) => ({
        ...site,
        client: {
          id: client.id,
          name: client.name,
          logoUrl: client.logoUrl,
        },
      }));
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
