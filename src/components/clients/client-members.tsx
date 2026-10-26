"use client";

import { useState } from "react";
import {
  Choice,
  ChoiceGroup,
  FormBanner,
  bannerMessage,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseClientBody,
  type Client,
  type SettingsUser,
} from "@/lib/clients";
import { parseUserList, sameIds, type User } from "@/lib/directory";
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
  const catalog = usersRequest.data;
  const memberChoices = personChoices(catalog, client.settings.members);
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

  if (canViewUsers && usersRequest.loading && !catalog) {
    return <p className="text-sm text-muted">Loading users…</p>;
  }

  return (
    <section className="grid gap-4">
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <ChoiceGroup legend="Members" messages={fieldErrors.memberIds}>
        <p className="text-sm leading-6 text-muted">
          Users who require access to the client.
        </p>
        {memberIds.length === 0 ? (
          <p className="text-sm text-muted">No members yet.</p>
        ) : null}
        {memberChoices.map((person) => (
          <Choice
            key={person.id}
            title={userLabel(person)}
            detail={person.name ? person.email : null}
            checked={memberIds.includes(person.id)}
            disabled={pending || usersRequest.loading}
            onChange={(checked) => {
              void saveMembers(
                checked
                  ? [...memberIds, person.id]
                  : memberIds.filter((id) => id !== person.id),
              );
            }}
          />
        ))}
      </ChoiceGroup>
    </section>
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
