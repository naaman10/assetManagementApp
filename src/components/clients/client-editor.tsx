"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClientContacts } from "@/components/clients/client-contacts";
import { ClientLogo } from "@/components/clients/client-logo";
import {
  ClientMembers,
  personChoices,
  userLabel,
} from "@/components/clients/client-members";
import { ClientSites } from "@/components/clients/client-sites";
import { Forbidden } from "@/components/forbidden";
import {
  ConfirmDelete,
  FieldMessages,
  FormBanner,
  bannerMessage,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { InlineAddress, InlineText, InlineTitle, Property } from "@/components/inline-field";
import { ClientProjects } from "@/components/projects/client-projects";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  logoFileProblem,
  parseClientBody,
  type Client,
  type ClientLead,
} from "@/lib/clients";
import { parseUserList } from "@/lib/directory";
import {
  CLIENTS_CREATE,
  CLIENTS_DELETE,
  CLIENTS_EDIT,
  CLIENTS_VIEW,
  USERS_VIEW,
  hasPermission,
} from "@/lib/session";

const tabs = [
  { id: "reports", label: "Reports", empty: "No reports yet." },
  { id: "contacts", label: "Contacts" },
  { id: "members", label: "Members" },
] as const;

type ClientTab = (typeof tabs)[number]["id"];

export function ClientEditor({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canCreate = hasPermission(user, CLIENTS_CREATE);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canDelete = hasPermission(user, CLIENTS_DELETE);
  const canViewUsers = hasPermission(user, USERS_VIEW);
  const request = useApi(canView ? `/api/clients/${id}` : null, parseClientBody);
  const usersRequest = useApi(
    canEdit && canViewUsers ? "/api/users" : null,
    parseUserList,
  );
  const [saved, setSaved] = useState<Client | null>(null);
  const [savedFor, setSavedFor] = useState(id);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<ClientTab>("reports");
  const [leadPending, setLeadPending] = useState(false);
  const [leadError, setLeadError] = useState<ApiRequestError | null>(null);
  const [sponsorPending, setSponsorPending] = useState(false);
  const [sponsorError, setSponsorError] = useState<ApiRequestError | null>(null);
  const tablistId = useId();
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/clients");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
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

  if (savedFor !== id) {
    setSavedFor(id);
    setSaved(null);
    setTab("reports");
    setLeadError(null);
    setSponsorError(null);
    setDeleteError(null);
  }

  const client = saved?.id === request.data?.id ? saved : request.data;

  if (!client) {
    return null;
  }

  const current = client;
  const leadOptions = leadContactOptions(client);
  const sponsorChoices = personChoices(usersRequest.data, client.settings.sponsor);

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

  async function saveSettings(patch: Record<string, unknown>) {
    try {
      setSaved(
        parseClientBody(
          await apiRequest(`/api/clients/${current.id}/settings`, {
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

  async function saveLead(leadContactId: string) {
    setLeadPending(true);
    setLeadError(null);

    try {
      await saveSettings({ leadContactId: leadContactId || null });
    } catch (caught) {
      setLeadError(asApiError(caught));
    } finally {
      setLeadPending(false);
    }
  }

  async function saveSponsor(sponsorUserId: string) {
    setSponsorPending(true);
    setSponsorError(null);

    try {
      await saveSettings({ sponsorUserId: sponsorUserId || null });
    } catch (caught) {
      setSponsorError(asApiError(caught));
    } finally {
      setSponsorPending(false);
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
    <div className="grid min-w-0 gap-8">
      <Breadcrumbs
        current
        items={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="grid min-w-0 gap-8">
          <section>
            <div className="flex flex-wrap items-start justify-between gap-6">
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
                <div className="mt-3 max-w-md">
                  <InlineText
                    label="Reference"
                    field="reference"
                    value={client.reference}
                    editable={canEdit}
                    maxLength={200}
                    onSave={async (reference) => {
                      const trimmed = reference.trim();

                      if (!trimmed) {
                        throw new ApiRequestError(400, "Invalid request", {
                          reference: ["Enter a reference."],
                        });
                      }

                      if (trimmed.length > 200) {
                        throw new ApiRequestError(400, "Invalid request", {
                          reference: ["Enter a reference up to 200 characters."],
                        });
                      }

                      await saveClient({ reference: trimmed });
                    }}
                  />
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
            <div className="border-b border-gray-200 pb-2">
              <h2 className="text-sm font-semibold text-gray-800">Sites</h2>
            </div>
            <div className="mt-4">
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
            </div>
          </section>

          <section>
            <div className="border-b border-gray-200 pb-2">
              <h2 className="text-sm font-semibold text-gray-800">Projects</h2>
            </div>
            <div className="mt-4">
              <ClientProjects clientId={client.id} />
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
                const count =
                  item.id === "contacts"
                    ? client.contacts.length
                    : item.id === "members"
                      ? client.settings.members.length
                      : null;

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
                    {count != null ? (
                      <span className="ml-2 font-medium text-gray-500">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div
              role="tabpanel"
              id={`${tablistId}-reports-panel`}
              aria-labelledby={`${tablistId}-reports`}
              hidden={tab !== "reports"}
              className="mt-6"
            >
              <p className="text-sm text-muted">No reports yet.</p>
            </div>
            <div
              role="tabpanel"
              id={`${tablistId}-contacts-panel`}
              aria-labelledby={`${tablistId}-contacts`}
              hidden={tab !== "contacts"}
              className="mt-6"
            >
              <ClientContacts
                client={client}
                canEdit={canEdit}
                onClient={setSaved}
                onMissing={() => {
                  router.replace("/clients");
                }}
              />
            </div>
            <div
              role="tabpanel"
              id={`${tablistId}-members-panel`}
              aria-labelledby={`${tablistId}-members`}
              hidden={tab !== "members"}
              className="mt-6"
            >
              <ClientMembers
                client={client}
                canEdit={canEdit}
                onClient={setSaved}
                onMissing={() => {
                  router.replace("/clients");
                }}
              />
            </div>
          </section>
        </div>

        <aside className="min-w-0 overflow-visible lg:sticky lg:top-24">
          <div className="min-w-0 overflow-visible rounded-card border border-gray-200 bg-surface shadow-card">
            <div className="overflow-hidden rounded-t-[var(--radius-card)] border-b border-gray-200 bg-surface-warm">
              <ClientLogo
                name={client.name}
                logoUrl={client.logoUrl}
                size="card"
                onReload={reloadLogo}
              />
              {canEdit ? (
                <div className="border-t border-gray-200 bg-surface px-5 py-3">
                  <LogoUpload
                    clientId={client.id}
                    onSaved={setSaved}
                    onMissing={() => {
                      router.replace("/clients");
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="overflow-visible p-5">
            <h2 className="text-sm font-semibold text-gray-800">Details</h2>
            <dl className="mt-5 grid min-w-0 gap-5 overflow-visible [&>*]:min-w-0">
              <InlineAddress
                address={client.address}
                editable={canEdit}
                onSave={async (address) => {
                  await saveClient({ address });
                }}
              />
              <Property label="Client lead">
                {canEdit ? (
                  client.contacts.length === 0 ? (
                    <LeadRequired
                      lead={client.settings.leadContact}
                      onShowContacts={() => {
                        setTab("contacts");
                      }}
                    />
                  ) : (
                    <>
                      <AssetTypePicker
                        id={`client-${client.id}-lead`}
                        types={leadOptions.map((contact) => ({
                          id: contact.id,
                          name: contact.name,
                          code: contact.role ?? "",
                        }))}
                        value={client.settings.leadContact?.id ?? ""}
                        disabled={leadPending}
                        showCode={leadOptions.some((contact) => Boolean(contact.role))}
                        inlineMenu
                        clearLabel="No lead"
                        listLabel="Contacts"
                        placeholder="Choose a lead"
                        searchPlaceholder="Search contacts"
                        onChange={(leadContactId) => {
                          void saveLead(leadContactId);
                        }}
                      />
                      {leadError ? (
                        <>
                          <FormBanner
                            message={bannerMessage(leadError.message, leadError.fieldErrors)}
                          />
                          <FieldMessages messages={leadError.fieldErrors.leadContactId} />
                        </>
                      ) : null}
                    </>
                  )
                ) : client.settings.leadContact ? (
                  client.settings.leadContact.name
                ) : (
                  "—"
                )}
              </Property>
              <Property label="Sponsor">
                {canEdit && canViewUsers ? (
                  <>
                    <AssetTypePicker
                      id={`client-${client.id}-sponsor`}
                      types={sponsorChoices.map((person) => ({
                        id: person.id,
                        name: userLabel(person),
                        code: "",
                      }))}
                      value={client.settings.sponsor?.id ?? ""}
                      disabled={sponsorPending || usersRequest.loading}
                      loading={usersRequest.loading}
                      showCode={false}
                      inlineMenu
                      clearLabel="No sponsor"
                      listLabel="People"
                      placeholder="Choose a sponsor"
                      searchPlaceholder="Search people"
                      loadingLabel="Loading people…"
                      onChange={(sponsorUserId) => {
                        void saveSponsor(sponsorUserId);
                      }}
                    />
                    {usersRequest.error ? (
                      <p className="mt-1.5 text-sm text-error-500" role="alert">
                        {usersRequest.error.message}
                      </p>
                    ) : null}
                    {sponsorError ? (
                      <>
                        <FormBanner
                          message={bannerMessage(
                            sponsorError.message,
                            sponsorError.fieldErrors,
                          )}
                        />
                        <FieldMessages messages={sponsorError.fieldErrors.sponsorUserId} />
                      </>
                    ) : null}
                  </>
                ) : canEdit && !canViewUsers ? (
                  <span className="text-sm font-normal text-muted">
                    Choosing users needs access to users.
                  </span>
                ) : client.settings.sponsor ? (
                  userLabel(client.settings.sponsor)
                ) : (
                  "—"
                )}
              </Property>
            </dl>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LeadRequired({
  lead,
  onShowContacts,
}: {
  lead: ClientLead | null;
  onShowContacts: () => void;
}) {
  return (
    <p className="text-sm font-normal leading-6 text-muted">
      {lead ? `${lead.name}. ` : null}
      Add a{" "}
      <button type="button" className="font-medium underline" onClick={onShowContacts}>
        contact
      </button>{" "}
      to set a lead.
    </p>
  );
}

function leadContactOptions(client: Client): ClientLead[] {
  const contacts = client.contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    role: contact.role,
    email: contact.email,
    telephone: contact.telephone,
  }));
  const lead = client.settings.leadContact;

  if (!lead || contacts.some((contact) => contact.id === lead.id)) {
    return contacts;
  }

  return [lead, ...contacts];
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
