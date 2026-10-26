"use client";

import { useState } from "react";
import {
  FieldMessages,
  FormBanner,
  bannerMessage,
} from "@/components/form-controls";
import { UserMultiPicker } from "@/components/projects/user-multi-picker";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseClientBody,
  type Client,
  type SettingsUser,
} from "@/lib/clients";
import { parseUserList, sameIds, type User } from "@/lib/directory";
import type { ProjectUser } from "@/lib/projects";
import { USERS_VIEW, hasPermission } from "@/lib/session";

export function ClientMembers({
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
  const { user } = useSession();
  const canViewUsers = hasPermission(user, USERS_VIEW);
  const usersRequest = useApi(
    canEdit && canViewUsers ? "/api/users" : null,
    parseUserList,
  );
  const settingsKey = [
    client.id,
    client.settings.members.map((member) => member.id).join("\n"),
  ].join("|");
  const [seenKey, setSeenKey] = useState(settingsKey);
  const [memberIds, setMemberIds] = useState(
    client.settings.members.map((member) => member.id),
  );
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);

  if (seenKey !== settingsKey) {
    setSeenKey(settingsKey);
    setMemberIds(client.settings.members.map((member) => member.id));
    setError(null);
  }

  const fieldErrors = error?.fieldErrors ?? {};
  const people = mergePeople(usersRequest.data, client.settings.members);
  const showUserAccessNote = canEdit && !canViewUsers;
  const usersProblem = usersRequest.error?.message ?? null;

  async function saveMembers(ids: string[]) {
    setMemberIds(ids);
    setPending(true);
    setError(null);

    try {
      if (
        sameIds(
          ids,
          client.settings.members.map((member) => member.id),
        )
      ) {
        return;
      }

      const body = await apiRequest(`/api/clients/${client.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ memberIds: ids }),
      });
      onClient(parseClientBody(body));
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setMemberIds(client.settings.members.map((member) => member.id));
      setError(apiError);
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="grid gap-3">
        {client.settings.members.length > 0 ? (
          <ul className="grid gap-2">
            {client.settings.members.map((member) => (
              <li key={member.id} className="text-sm font-medium text-gray-800">
                {userLabel(member)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No members yet.</p>
        )}
      </section>
    );
  }

  if (showUserAccessNote) {
    return (
      <p className="text-sm leading-6 text-muted">
        Choosing users needs access to users.
      </p>
    );
  }

  if (usersProblem) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {usersProblem}
      </p>
    );
  }

  return (
    <section className="grid max-w-xl gap-4">
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <div>
        <label
          id={`client-${client.id}-members-label`}
          className="block text-sm font-medium text-gray-700"
          htmlFor={`client-${client.id}-members`}
        >
          Members
        </label>
        <p className="mt-1 text-sm text-gray-500">
          Users who require access to the client.
        </p>
        <div className="mt-1.5">
          <UserMultiPicker
            id={`client-${client.id}-members`}
            users={people}
            value={memberIds}
            disabled={pending}
            loading={usersRequest.loading}
            onChange={(ids) => {
              void saveMembers(ids);
            }}
          />
        </div>
        <FieldMessages messages={fieldErrors.memberIds} />
      </div>
    </section>
  );
}

function mergePeople(
  catalog: User[] | null | undefined,
  members: SettingsUser[],
): ProjectUser[] {
  const byId = new Map<string, ProjectUser>();

  for (const person of catalog ?? []) {
    byId.set(person.id, { id: person.id, email: person.email, name: person.name });
  }

  for (const member of members) {
    if (!byId.has(member.id)) {
      byId.set(member.id, {
        id: member.id,
        email: member.email,
        name: member.name,
      });
    }
  }

  return [...byId.values()].sort((left, right) =>
    userLabel(left).localeCompare(userLabel(right)),
  );
}

export function personChoices(
  catalog: User[] | null | undefined,
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

export function userLabel(user: { name: string | null; email: string }) {
  return user.name ?? user.email;
}
