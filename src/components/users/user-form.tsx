"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Choice,
  ChoiceGroup,
  FormBanner,
  PageHeading,
  TextField,
  bannerMessage,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError } from "@/lib/api-client";
import { parseUserBody, sameIds, type Role, type User } from "@/lib/directory";

export function UserForm({
  user,
  roles,
  rolesError,
  onSaved,
}: {
  user?: User;
  roles: Role[] | null;
  rolesError: string | null;
  onSaved?: (user: User) => void;
}) {
  const router = useRouter();
  const { user: sessionUser, refresh } = useSession();
  const creating = !user;
  const [baseline, setBaseline] = useState(user);
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [disabled, setDisabled] = useState(user?.disabled ?? false);
  const [roleIds, setRoleIds] = useState<string[]>(
    user?.roles.map((role) => role.id) ?? [],
  );
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const allowDisable = Boolean(baseline) && baseline?.id !== sessionUser.id;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = creating
      ? createPayload(email, name, password, roles ? roleIds : null)
      : updatePayload(baseline ?? user, {
          email,
          name,
          password,
          disabled: allowDisable ? disabled : (baseline ?? user).disabled,
          roleIds: roles ? roleIds : null,
        });

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);

    try {
      const body = await apiRequest(
        creating ? "/api/users" : `/api/users/${(baseline ?? user).id}`,
        {
          method: creating ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      const saved = parseUserBody(body);
      setPassword("");

      if (creating) {
        router.push(`/settings/users/${saved.id}`);
        return;
      }

      onSaved?.(saved);
      setBaseline(saved);

      if (saved.id === sessionUser.id && "roleIds" in payload) {
        await refresh();
      }
      setEmail(saved.email);
      setName(saved.name ?? "");
      setDisabled(saved.disabled);
      setRoleIds(saved.roles.map((role) => role.id));
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  const current = baseline ?? user;

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading title={creating ? "Create user" : (current?.email ?? "User")} />
      <form className="mt-8 grid gap-5" method="post" onSubmit={onSubmit}>
        <FormBanner
          message={bannerMessage(
            error?.message ?? null,
            error?.fieldErrors ?? {},
          )}
        />
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          required
          value={email}
          disabled={pending}
          messages={error?.fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <TextField
          id="name"
          name="name"
          label="Name"
          autoComplete="off"
          value={name}
          disabled={pending}
          messages={error?.fieldErrors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          id="password"
          name="password"
          label={creating ? "Password" : "New password"}
          type="password"
          autoComplete="new-password"
          required={creating}
          minLength={creating ? 8 : undefined}
          maxLength={128}
          value={password}
          disabled={pending}
          messages={error?.fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        {allowDisable ? (
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4"
              checked={disabled}
              disabled={pending}
              onChange={(event) => {
                setDisabled(event.target.checked);
              }}
            />
            Disabled
          </label>
        ) : null}
        {roles ? (
          <RoleChoices
            roles={roles}
            roleIds={roleIds}
            disabled={pending}
            messages={error?.fieldErrors.roleIds}
            onChange={setRoleIds}
          />
        ) : (
          <p className="text-sm leading-6 text-ink" role="alert">
            {rolesError ?? "Roles could not be loaded."}
          </p>
        )}
        {current ? (
          <p className="text-sm text-muted">
            Permissions:{" "}
            {current.permissions.length > 0
              ? current.permissions.join(", ")
              : "None"}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className={primaryButtonClassName}
        >
          {pending ? "Saving…" : creating ? "Create user" : "Save"}
        </button>
      </form>
    </section>
  );
}

function RoleChoices({
  roles,
  roleIds,
  disabled,
  messages,
  onChange,
}: {
  roles: Role[];
  roleIds: string[];
  disabled: boolean;
  messages?: string[];
  onChange: (roleIds: string[]) => void;
}) {
  return (
    <ChoiceGroup legend="Roles" messages={messages}>
      {roles.length === 0 ? (
        <p className="text-sm text-muted">No roles yet.</p>
      ) : (
        roles.map((role) => (
          <Choice
            key={role.id}
            title={role.name}
            detail={role.description}
            checked={roleIds.includes(role.id)}
            disabled={disabled}
            onChange={(checked) => {
              onChange(
                checked
                  ? [...roleIds, role.id]
                  : roleIds.filter((id) => id !== role.id),
              );
            }}
          />
        ))
      )}
    </ChoiceGroup>
  );
}

function createPayload(
  email: string,
  name: string,
  password: string,
  roleIds: string[] | null,
) {
  const payload: Record<string, unknown> = {
    email: email.trim(),
    password,
  };
  const trimmedName = name.trim();

  if (trimmedName) {
    payload.name = trimmedName;
  }

  if (roleIds && roleIds.length > 0) {
    payload.roleIds = roleIds;
  }

  return payload;
}

function updatePayload(
  user: User | undefined,
  input: {
    email: string;
    name: string;
    password: string;
    disabled: boolean;
    roleIds: string[] | null;
  },
) {
  if (!user) {
    return null;
  }

  const payload: Record<string, unknown> = {};
  const email = input.email.trim().toLowerCase();

  if (email !== user.email) {
    payload.email = email;
  }

  const name = input.name.trim();
  const nextName = name.length > 0 ? name : null;

  if (nextName !== user.name) {
    payload.name = nextName;
  }

  if (input.password.length > 0) {
    payload.password = input.password;
  }

  if (input.disabled !== user.disabled) {
    payload.disabled = input.disabled;
  }

  if (
    input.roleIds &&
    !sameIds(
      input.roleIds,
      user.roles.map((role) => role.id),
    )
  ) {
    payload.roleIds = input.roleIds;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}
