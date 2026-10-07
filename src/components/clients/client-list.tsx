"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientForm } from "@/components/clients/client-form";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import { DataTable, PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parseClientBody, parseClientList, type Client } from "@/lib/clients";
import { CLIENTS_CREATE, CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function ClientList() {
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canCreate = hasPermission(user, CLIENTS_CREATE);
  const request = useApi(canView ? "/api/clients" : null, parseClientList);
  const [rows, setRows] = useState<Client[] | null>(null);
  const [rowsFrom, setRowsFrom] = useState<Client[] | null>(null);
  const [creating, setCreating] = useState(false);

  if (request.data !== rowsFrom) {
    setRowsFrom(request.data);
    setRows(request.data);
  }

  if (!canView) {
    return <Forbidden />;
  }

  async function refreshLogo(clientId: string): Promise<string | null> {
    const body = await apiRequest(`/api/clients/${clientId}`);
    const next = parseClientBody(body);
    setRows((current) =>
      current?.map((client) => (client.id === next.id ? next : client)) ?? current,
    );
    return next.logoUrl;
  }

  const clients = rows ?? [];

  return (
    <section>
      <PageHeading
        title="Clients"
        action={
          canCreate ? (
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setCreating(true);
              }}
            >
              Create client
            </button>
          ) : null
        }
      />
      {request.loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading clients…</p>
      ) : null}
      {request.error ? (
        request.error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={request.error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(request.error).message}
          </p>
        )
      ) : null}
      {request.data ? (
        <ClientRows
          clients={clients}
          onReload={async (clientId) => {
            try {
              return await refreshLogo(clientId);
            } catch (error) {
              if (asApiError(error).status === 404) {
                setRows((current) =>
                  current?.filter((client) => client.id !== clientId) ?? current,
                );
                return null;
              }

              throw error;
            }
          }}
        />
      ) : null}
      {creating ? (
        <Modal
          title="Create client"
          onClose={() => {
            setCreating(false);
          }}
        >
          <ClientForm
            embedded
            onCancel={() => {
              setCreating(false);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function ClientRows({
  clients,
  onReload,
}: {
  clients: Client[];
  onReload: (clientId: string) => Promise<string | null>;
}) {
  if (clients.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No clients yet.</p>;
  }

  return (
    <DataTable columns={["Client", "Reference", "Location"]}>
      {clients.map((client) => (
        <tr key={client.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
              <ClientLogo
                name={client.name}
                logoUrl={client.logoUrl}
                size="list"
                onReload={() => onReload(client.id)}
              />
              <span className="truncate text-sm font-medium text-gray-800">
                {client.name}
              </span>
            </Link>
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">{client.reference ?? "—"}</td>
          <td className="px-5 py-4 text-sm text-gray-500">
            {client.address.city}
            {" · "}
            {client.address.postcode}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
