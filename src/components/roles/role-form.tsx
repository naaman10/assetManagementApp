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
import {
  parseRoleBody,
  sameIds,
  type Permission,
  type Role,
} from "@/lib/directory";
import { ADMIN_ROLE } from "@/lib/session";

export function RoleForm({
  role,
  catalog,
  catalogError,
  editable,
}: {
  role?: Role;
  catalog: Permission[] | null;
  catalogError: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const { user, refresh } = useSession();
  const creating = !role;
  const lockName = role?.name === ADMIN_ROLE;
  const [baseline, setBaseline] = useState(role);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissionIds, setPermissionIds] = useState<string[]>(
    role?.permissions.map((permission) => permission.id) ?? [],
  );
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editable) {
      return;
    }

    setError(null);
    const current = baseline ?? role;
    const payload = creating
      ? createPayload(name, description, catalog ? permissionIds : null)
      : current
        ? updatePayload(current, {
            name: lockName ? current.name : name,
            description,
            permissionIds: catalog ? permissionIds : null,
            lockName,
          })
        : null;

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    const path = creating
      ? "/api/roles"
      : current
        ? `/api/roles/${current.id}`
        : null;

    if (!path) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);

    try {
      const body = await apiRequest(path, {
        method: creating ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      const saved = parseRoleBody(body);

      if (user.roles.some((item) => item.id === saved.id)) {
        await refresh();
      }

      if (creating) {
        router.push(`/settings/roles/${saved.id}`);
        return;
      }

      setBaseline(saved);
      setName(saved.name);
      setDescription(saved.description ?? "");
      setPermissionIds(saved.permissions.map((permission) => permission.id));
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  const title = creating ? "Create role" : (baseline ?? role).name;

  return (
    <section className="max-w-xl">
      <PageHeading title={title} />
      <form className="mt-8 grid gap-5" method="post" onSubmit={onSubmit}>
        <FormBanner
          message={bannerMessage(
            error?.message ?? null,
            error?.fieldErrors ?? {},
          )}
        />
        {lockName ? null : (
          <TextField
            id="name"
            name="name"
            label="Name"
            required
            maxLength={80}
            value={name}
            disabled={pending || !editable}
            messages={error?.fieldErrors.name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        )}
        <div>
          <label className="block text-sm font-medium" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={500}
            value={description}
            disabled={pending || !editable}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="mt-2 min-h-28 w-full rounded-card border border-line bg-surface px-4 py-3 text-sm disabled:opacity-60"
          />
          {error?.fieldErrors.description ? (
            <p className="mt-2 text-sm leading-6 text-ink" role="alert">
              {error.fieldErrors.description.join(" ")}
            </p>
          ) : null}
        </div>
        {catalog ? (
          <ChoiceGroup legend="Permissions" messages={error?.fieldErrors.permissionIds}>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted">No permissions are defined.</p>
            ) : (
              catalog.map((permission) => (
                <Choice
                  key={permission.id}
                  title={permission.name}
                  detail={permission.description}
                  checked={permissionIds.includes(permission.id)}
                  disabled={pending || !editable}
                  onChange={(checked) => {
                    setPermissionIds((current) =>
                      checked
                        ? [...current, permission.id]
                        : current.filter((id) => id !== permission.id),
                    );
                  }}
                />
              ))
            )}
          </ChoiceGroup>
        ) : (
          <PermissionNames role={baseline ?? role} message={catalogError} />
        )}
        {editable ? (
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClassName}
          >
            {pending ? "Saving…" : creating ? "Create role" : "Save"}
          </button>
        ) : null}
      </form>
    </section>
  );
}

function PermissionNames({
  role,
  message,
}: {
  role?: Role;
  message: string | null;
}) {
  if (!role) {
    return null;
  }

  if (message && role.permissions.length === 0) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {message}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-medium">Permissions</h2>
      {role.permissions.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No permissions</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {role.permissions.map((permission) => (
            <li key={permission.id} className="text-sm">
              <span className="font-medium">{permission.name}</span>
              {permission.description ? (
                <span className="mt-1 block text-muted">
                  {permission.description}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function createPayload(
  name: string,
  description: string,
  permissionIds: string[] | null,
) {
  const payload: Record<string, unknown> = { name: name.trim() };
  const trimmed = description.trim();

  if (trimmed) {
    payload.description = trimmed;
  }

  if (permissionIds && permissionIds.length > 0) {
    payload.permissionIds = permissionIds;
  }

  return payload;
}

function updatePayload(
  role: Role | undefined,
  input: {
    name: string;
    description: string;
    permissionIds: string[] | null;
    lockName: boolean;
  },
) {
  if (!role) {
    return null;
  }

  const payload: Record<string, unknown> = {};
  const name = input.name.trim();

  if (!input.lockName && name !== role.name) {
    payload.name = name;
  }

  const description = input.description.trim();
  const nextDescription = description.length > 0 ? description : null;

  if (nextDescription !== role.description) {
    payload.description = nextDescription;
  }

  if (
    input.permissionIds &&
    !sameIds(
      input.permissionIds,
      role.permissions.map((permission) => permission.id),
    )
  ) {
    payload.permissionIds = input.permissionIds;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}
