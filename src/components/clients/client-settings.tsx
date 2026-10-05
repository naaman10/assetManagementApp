"use client";

import { useState } from "react";
import {
  Choice,
  ChoiceGroup,
  FieldMessages,
  FormBanner,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseClientBody,
  type Client,
  type ClientLead,
  type SettingsUser,
} from "@/lib/clients";
import { parseUserList, sameIds, type User } from "@/lib/directory";
import { USERS_VIEW, hasPermission } from "@/lib/session";

export function ClientSettings({
  client,
  canEdit,
  onClient,
  onMissing,
  onShowContacts,
}: {
  client: Client;
  canEdit: boolean;
  onClient: (client: Client) => void;
  onMissing: () => void;
  onShowContacts: () => void;
}) {
  const { user } = useSession();
  const canViewUsers = hasPermission(user, USERS_VIEW);
  const usersRequest = useApi(
    canEdit && canViewUsers ? "/api/users" : null,
    parseUserList,
  );
  const settingsKey = clientSettingsKey(client);
  const [seenKey, setSeenKey] = useState(settingsKey);
  const [leadId, setLeadId] = useState(client.settings.leadContact?.id ?? "");
  const [sponsorId, setSponsorId] = useState(client.settings.sponsor?.id ?? "");
  const [memberIds, setMemberIds] = useState(
    client.settings.members.map((member) => member.id),
  );
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);

  if (seenKey !== settingsKey) {
    setSeenKey(settingsKey);
    setLeadId(client.settings.leadContact?.id ?? "");
    setSponsorId(client.settings.sponsor?.id ?? "");
    setMemberIds(client.settings.members.map((member) => member.id));
    setError(null);
  }

  const fieldErrors = error?.fieldErrors ?? {};
  const catalog = usersRequest.data;
  const choosingUsers = Boolean(catalog);
  const showUserAccessNote = canEdit && !canViewUsers;
  const usersProblem = usersRequest.error?.message ?? null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = settingsPayload(client, { leadId, sponsorId, memberIds });

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body = await apiRequest(`/api/clients/${client.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onClient(parseClientBody(body));
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setError(apiError);
    } finally {
      setPending(false);
    }
  }

  const lead = (
    <SettingsGroup
      title="Client lead"
      detail="A contact on this client. This person does not gain access to the client."
    >
      {canEdit ? (
        client.contacts.length === 0 ? (
          <LeadRequired
            lead={client.settings.leadContact}
            onShowContacts={onShowContacts}
          />
        ) : (
          <SelectField
            id="client-lead"
            label="Client lead"
            value={leadId}
            pending={pending}
            messages={fieldErrors.leadContactId}
            onChange={setLeadId}
          >
            <option value="">None</option>
            {leadOptions(client).map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </SelectField>
        )
      ) : client.settings.leadContact ? (
        <p className="text-sm font-medium">{client.settings.leadContact.name}</p>
      ) : (
        <EmptyValue>No client lead</EmptyValue>
      )}
    </SettingsGroup>
  );

  const sponsorChoices = personChoices(catalog, client.settings.sponsor);
  const memberChoices = personChoices(catalog, client.settings.members);

  const sponsor = (
    <SettingsGroup
      title="Sponsor"
      detail="One user. The sponsor can see this client."
    >
      {canEdit && (choosingUsers || client.settings.sponsor) ? (
        <SelectField
          id="client-sponsor"
          label="Sponsor"
          value={sponsorId}
          pending={pending || usersRequest.loading}
          messages={fieldErrors.sponsorUserId}
          onChange={setSponsorId}
        >
          <option value="">None</option>
          {sponsorChoices.map((person) => (
            <option key={person.id} value={person.id}>
              {userLabel(person)}
            </option>
          ))}
        </SelectField>
      ) : client.settings.sponsor ? (
        <p className="text-sm font-medium">{userLabel(client.settings.sponsor)}</p>
      ) : (
        <EmptyValue>No sponsor</EmptyValue>
      )}
    </SettingsGroup>
  );

  const members =
    canEdit && (choosingUsers || memberChoices.length > 0) ? (
      <ChoiceGroup legend="Members" messages={fieldErrors.memberIds}>
        <p className="text-sm leading-6 text-muted">
          Any number of users. Members can see this client. The sponsor may also be a member.
        </p>
        {memberIds.length === 0 ? <EmptyValue>No members yet.</EmptyValue> : null}
        {memberChoices.map((person) => (
          <Choice
            key={person.id}
            title={userLabel(person)}
            detail={person.name ? person.email : null}
            checked={memberIds.includes(person.id)}
            disabled={pending || usersRequest.loading}
            onChange={(checked) => {
              setMemberIds((current) =>
                checked
                  ? [...current, person.id]
                  : current.filter((id) => id !== person.id),
              );
            }}
          />
        ))}
      </ChoiceGroup>
    ) : (
      <SettingsGroup
        title="Members"
        detail="Any number of users. Members can see this client. The sponsor may also be a member."
      >
        {client.settings.members.length > 0 ? (
          <ul className="grid gap-2">
            {client.settings.members.map((member) => (
              <li key={member.id} className="text-sm font-medium">
                {userLabel(member)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyValue>No members yet.</EmptyValue>
        )}
      </SettingsGroup>
    );

  const groups = (
    <div className="grid gap-8">
      {lead}
      {showUserAccessNote ? (
        <p className="text-sm leading-6 text-muted">
          Choosing users needs access to users.
        </p>
      ) : null}
      {usersProblem ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {usersProblem}
        </p>
      ) : null}
      {canEdit && canViewUsers && usersRequest.loading ? (
        <p className="text-sm text-muted">Loading users…</p>
      ) : (
        <>
          {sponsor}
          {members}
        </>
      )}
    </div>
  );

  return (
    <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
      {canEdit ? (
        <form
          className="grid gap-8"
          method="post"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
          {groups}
          <button
            type="submit"
            disabled={pending || (canViewUsers && usersRequest.loading)}
            className={primaryButtonClassName}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        groups
      )}
    </section>
  );
}

function SettingsGroup({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyValue({ children }: { children: string }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function LeadRequired({
  lead,
  onShowContacts,
}: {
  lead: ClientLead | null;
  onShowContacts: () => void;
}) {
  return (
    <div className="grid gap-3">
      {lead ? (
        <p className="text-sm font-medium">{lead.name}</p>
      ) : (
        <EmptyValue>No client lead</EmptyValue>
      )}
      <p className="text-sm leading-6">
        A contact is required to set a client lead. Add one from the{" "}
        <button type="button" className="font-medium underline" onClick={onShowContacts}>
          Contacts tab
        </button>
        .
      </p>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  pending,
  messages,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  pending: boolean;
  messages?: string[];
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={pending}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {children}
      </select>
      <FieldMessages messages={messages} />
    </div>
  );
}

function leadOptions(client: Client): ClientLead[] {
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

function personChoices(
  catalog: User[] | null,
  current: SettingsUser | SettingsUser[] | null,
): SettingsUser[] {
  const selected = Array.isArray(current) ? current : current ? [current] : [];

  if (!catalog) {
    return selected;
  }

  const byId = new Map<string, SettingsUser>();

  for (const person of catalog) {
    byId.set(person.id, person);
  }

  for (const person of selected) {
    if (!byId.has(person.id)) {
      byId.set(person.id, person);
    }
  }

  return [...byId.values()].sort((left, right) =>
    userLabel(left).localeCompare(userLabel(right)),
  );
}

function userLabel(user: { name: string | null; email: string }) {
  return user.name ?? user.email;
}

function settingsPayload(
  client: Client,
  draft: { leadId: string; sponsorId: string; memberIds: string[] },
) {
  const payload: {
    leadContactId?: string | null;
    sponsorUserId?: string | null;
    memberIds?: string[];
  } = {};
  const leadId = draft.leadId || null;
  const sponsorId = draft.sponsorId || null;

  if (client.contacts.length > 0 && leadId !== (client.settings.leadContact?.id ?? null)) {
    payload.leadContactId = leadId;
  }

  if (sponsorId !== (client.settings.sponsor?.id ?? null)) {
    payload.sponsorUserId = sponsorId;
  }

  if (
    !sameIds(
      draft.memberIds,
      client.settings.members.map((member) => member.id),
    )
  ) {
    payload.memberIds = draft.memberIds;
  }

  return payload.leadContactId !== undefined ||
    payload.sponsorUserId !== undefined ||
    payload.memberIds
    ? payload
    : null;
}

function clientSettingsKey(client: Client) {
  return [
    client.id,
    client.settings.leadContact?.id ?? "",
    client.settings.sponsor?.id ?? "",
    client.settings.members.map((member) => member.id).join("\n"),
  ].join("|");
}
