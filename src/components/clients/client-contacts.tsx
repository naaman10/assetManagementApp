"use client";

import { useState } from "react";
import {
  ConfirmDelete,
  FormBanner,
  TextField,
  bannerMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import {
  ApiRequestError,
  apiRequest,
  asApiError,
  type FieldErrors,
} from "@/lib/api-client";
import { parseClientBody, type Client, type Contact } from "@/lib/clients";

export function ClientContacts({
  client,
  canEdit,
  onClient,
  onMissing,
}: {
  client: Client;
  canEdit: boolean;
  onClient: (client: Client) => void;
  onMissing: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight">Contacts</h2>
        {canEdit && !adding ? (
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            Add contact
          </button>
        ) : null}
      </div>
      {client.contacts.length === 0 && !adding ? (
        <p className="mt-6 text-sm text-muted">No contacts yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {client.contacts.map((contact) => (
            <li key={contact.id} className="rounded-card bg-surface p-5 shadow-card">
              {editingId === contact.id ? (
                <ContactForm
                  clientId={client.id}
                  contact={contact}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                  onClient={(next) => {
                    setEditingId(null);
                    onClient(next);
                  }}
                  onMissing={onMissing}
                />
              ) : (
                <ContactSummary
                  clientId={client.id}
                  contact={contact}
                  canEdit={canEdit}
                  onEdit={() => {
                    setAdding(false);
                    setEditingId(contact.id);
                  }}
                  onDeleted={() => {
                    onClient({
                      ...client,
                      contacts: client.contacts.filter((item) => item.id !== contact.id),
                    });
                  }}
                  onMissing={onMissing}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="mt-4 rounded-card bg-surface p-5 shadow-card">
          <ContactForm
            clientId={client.id}
            onCancel={() => {
              setAdding(false);
            }}
            onClient={(next) => {
              setAdding(false);
              onClient(next);
            }}
            onMissing={onMissing}
          />
        </div>
      ) : null}
    </section>
  );
}

function ContactSummary({
  clientId,
  contact,
  canEdit,
  onEdit,
  onDeleted,
  onMissing,
}: {
  clientId: string;
  contact: Contact;
  canEdit: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onMissing: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    setError(null);

    try {
      await apiRequest(`/api/clients/${clientId}/contacts/${contact.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setError(apiError.message);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="font-medium">{contact.name}</p>
        <p className="mt-1 text-sm text-muted">{contactDetails(contact)}</p>
      </div>
      {error ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={secondaryButtonClassName} onClick={onEdit}>
            Edit
          </button>
          <ConfirmDelete
            label="Delete contact"
            question="Delete this contact?"
            pending={pending}
            onConfirm={() => {
              void remove();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ContactForm({
  clientId,
  contact,
  onCancel,
  onClient,
  onMissing,
}: {
  clientId: string;
  contact?: Contact;
  onCancel: () => void;
  onClient: (client: Client) => void;
  onMissing: () => void;
}) {
  const creating = !contact;
  const [name, setName] = useState(contact?.name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [telephone, setTelephone] = useState(contact?.telephone ?? "");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = contact
      ? changedContact(contact, { name, role, email, telephone })
      : newContact({ name, role, email, telephone });

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body = await apiRequest(
        contact
          ? `/api/clients/${clientId}/contacts/${contact.id}`
          : `/api/clients/${clientId}/contacts`,
        {
          method: contact ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      onClient(parseClientBody(body));
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setError(apiError);
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-5"
      method="post"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <ContactFields
        idPrefix={contact?.id ?? "new-contact"}
        name={name}
        role={role}
        email={email}
        telephone={telephone}
        pending={pending}
        fieldErrors={fieldErrors}
        onName={setName}
        onRole={setRole}
        onEmail={setEmail}
        onTelephone={setTelephone}
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "Add contact" : "Save"}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ContactFields({
  idPrefix,
  name,
  role,
  email,
  telephone,
  pending,
  fieldErrors,
  onName,
  onRole,
  onEmail,
  onTelephone,
}: {
  idPrefix: string;
  name: string;
  role: string;
  email: string;
  telephone: string;
  pending: boolean;
  fieldErrors: FieldErrors;
  onName: (value: string) => void;
  onRole: (value: string) => void;
  onEmail: (value: string) => void;
  onTelephone: (value: string) => void;
}) {
  return (
    <>
      <TextField
        id={`${idPrefix}-name`}
        label="Name"
        autoComplete="name"
        required
        maxLength={200}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          onName(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-role`}
        label="Role"
        autoComplete="organization-title"
        maxLength={80}
        value={role}
        disabled={pending}
        messages={fieldErrors.role}
        onChange={(event) => {
          onRole(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-email`}
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        disabled={pending}
        messages={fieldErrors.email}
        onChange={(event) => {
          onEmail(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-telephone`}
        label="Telephone"
        type="tel"
        autoComplete="tel"
        maxLength={40}
        value={telephone}
        disabled={pending}
        messages={fieldErrors.telephone}
        onChange={(event) => {
          onTelephone(event.target.value);
        }}
      />
    </>
  );
}

function newContact(draft: {
  name: string;
  role: string;
  email: string;
  telephone: string;
}) {
  const payload: Record<string, string> = { name: draft.name.trim() };
  const role = draft.role.trim();
  const email = draft.email.trim();
  const telephone = draft.telephone.trim();

  if (role) {
    payload.role = role;
  }

  if (email) {
    payload.email = email;
  }

  if (telephone) {
    payload.telephone = telephone;
  }

  return payload;
}

function changedContact(
  contact: Contact,
  draft: { name: string; role: string; email: string; telephone: string },
) {
  const payload: Record<string, string | null> = {};
  const name = draft.name.trim();
  const role = emptyToNull(draft.role);
  const email = emptyToNull(draft.email);
  const telephone = emptyToNull(draft.telephone);

  if (name !== contact.name) {
    payload.name = name;
  }

  if (role !== contact.role) {
    payload.role = role;
  }

  if (email !== contact.email) {
    payload.email = email;
  }

  if (telephone !== contact.telephone) {
    payload.telephone = telephone;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function contactDetails(contact: Contact): string {
  const parts = [contact.role, contact.email, contact.telephone].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(" · ") : "No role, email, or telephone";
}
