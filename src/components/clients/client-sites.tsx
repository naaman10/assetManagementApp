"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteForm } from "@/components/sites/site-form";
import { DataTable, secondaryButtonClassName } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import type { Client } from "@/lib/clients";

export function ClientSites({
  client,
  canCreate,
  onClient,
  onMissing,
  onShowContacts,
}: {
  client: Client;
  canCreate: boolean;
  onClient: (client: Client) => void;
  onMissing: () => void;
  onShowContacts: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [clientId, setClientId] = useState(client.id);

  if (clientId !== client.id) {
    setClientId(client.id);
    setAdding(false);
  }

  return (
    <section>
      {canCreate && !adding ? (
        <div className="flex justify-end">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setAdding(true);
            }}
          >
            Add site
          </button>
        </div>
      ) : null}
      {client.sites.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No sites yet.</p>
      ) : (
        <DataTable columns={["Site", "Reference", "Location"]}>
          {client.sites.map((site) => (
            <tr key={site.id} className="hover:bg-gray-50">
              <td className="px-5 py-4">
                <Link
                  href={`/sites/${site.id}`}
                  className="text-sm font-medium text-gray-800"
                >
                  {site.name}
                </Link>
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{site.reference ?? "—"}</td>
              <td className="px-5 py-4 text-sm text-gray-500">
                {site.address.city}
                {" · "}
                {site.address.postcode}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {adding ? (
        <Modal
          title="Add site"
          onClose={() => {
            setAdding(false);
          }}
        >
          {client.contacts.length === 0 ? (
            <ContactRequired
              onShowContacts={() => {
                setAdding(false);
                onShowContacts();
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <SiteForm
              clientId={client.id}
              contacts={client.contacts}
              onCancel={() => {
                setAdding(false);
              }}
              onMissing={onMissing}
              onCreated={(next) => {
                setAdding(false);
                onClient(next);
              }}
            />
          )}
        </Modal>
      ) : null}
    </section>
  );
}

function ContactRequired({
  onShowContacts,
  onCancel,
}: {
  onShowContacts: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-6">
        A contact is required to add a site. Add one from the{" "}
        <button type="button" className="font-medium underline" onClick={onShowContacts}>
          Contacts tab
        </button>
        .
      </p>
      <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
