"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientAudits } from "@/components/audits/client-audits";
import { ClientContacts } from "@/components/clients/client-contacts";
import { ClientLogo } from "@/components/clients/client-logo";
import { ClientSettings } from "@/components/clients/client-settings";
import { ClientSites } from "@/components/clients/client-sites";
import { Forbidden } from "@/components/forbidden";
import {
  ConfirmDelete,
  FormBanner,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { InlineAddress, InlineText, InlineTitle, PropertyGrid } from "@/components/inline-field";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { logoFileProblem, parseClientBody, type Client } from "@/lib/clients";
import {
  CLIENTS_CREATE,
  CLIENTS_DELETE,
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
  const canDelete = hasPermission(user, CLIENTS_DELETE);
  const request = useApi(canView ? `/api/clients/${id}` : null, parseClientBody);
  const [saved, setSaved] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const current = client;

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

  async function saveClient(patch: Record<string, unknown>) {
    try {
      setSaved(
        parseClientBody(
          await apiRequest(`/api/clients/${current.id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ),
      );
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/clients");
      }

      throw apiError;
    }
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/clients/${current.id}`, { method: "DELETE" });
      router.push("/clients");
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/clients");
        return;
      }

      setDeleteError(apiError.message);
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-6">
            <div className="grid gap-3">
              <ClientLogo
                name={client.name}
                logoUrl={client.logoUrl}
                size="detail"
                onReload={reloadLogo}
              />
              {canEdit ? (
                <LogoUpload
                  clientId={client.id}
                  onSaved={setSaved}
                  onMissing={() => {
                    router.replace("/clients");
                  }}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Client</p>
              <InlineTitle
                value={client.name}
                editable={canEdit}
                onSave={async (name) => {
                  if (!name) {
                    throw new ApiRequestError(400, "Invalid request", {
                      name: ["Enter a name."],
                    });
                  }

                  await saveClient({ name });
                }}
              />
              <PropertyGrid>
                <InlineText
                  label="Reference"
                  field="reference"
                  value={client.reference ?? ""}
                  editable={canEdit}
                  maxLength={200}
                  onSave={async (reference) => {
                    await saveClient({ reference: reference || null });
                  }}
                />
                <InlineAddress
                  address={client.address}
                  editable={canEdit}
                  onSave={async (address) => {
                    await saveClient({ address });
                  }}
                />
              </PropertyGrid>
            </div>
          </div>
          {canDelete ? (
            <div className="grid gap-3">
              {deleteError ? (
                <p className="text-sm leading-6 text-ink" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <ConfirmDelete
                label="Delete client"
                question="Delete this client? The logo and contacts will be deleted too."
                pending={deleting}
                onConfirm={() => {
                  void remove();
                }}
              />
            </div>
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
            ) : item.id === "audits" ? (
              <ClientAudits clientId={client.id} />
            ) : (
              <p className="text-sm text-muted">{item.empty}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function LogoUpload({
  clientId,
  onSaved,
  onMissing,
}: {
  clientId: string;
  onSaved: (client: Client) => void;
  onMissing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function upload() {
    if (!file) {
      setMessage("A logo image is required.");
      return;
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const problem = logoFileProblem(bytes, file.size);

    if (problem) {
      setMessage(problem);
      return;
    }

    const body = new FormData();
    body.set("logo", file);
    setPending(true);
    setMessage(null);

    try {
      const response = await apiRequest(`/api/clients/${clientId}/logo`, {
        method: "PUT",
        body,
      });
      onSaved(parseClientBody(response));
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setMessage(
        apiError.message === "Logo storage is unavailable."
          ? "The logo could not be saved."
          : apiError.message,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <FormBanner message={message} />
      <div className="flex flex-wrap items-center gap-3">
        <label className={secondaryButtonClassName}>
          Choose logo
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage(null);
            }}
          />
        </label>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={() => {
            void upload();
          }}
        >
          {pending ? "Uploading…" : "Upload logo"}
        </button>
      </div>
      {file ? <p className="text-sm text-muted">{file.name}</p> : null}
    </div>
  );
}
