"use client";

import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { useApi } from "@/lib/api-client";
import { parseRoleList, type Role } from "@/lib/directory";
import { hasPermission, ROLES_CREATE, ROLES_VIEW } from "@/lib/session";

export function RoleList() {
  const { user } = useSession();
  const canView = hasPermission(user, ROLES_VIEW);
  const canCreate = hasPermission(user, ROLES_CREATE);
  const { data, error, loading } = useApi(
    canView ? "/api/roles" : null,
    parseRoleList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="Roles"
        action={
          canCreate ? (
            <Link href="/settings/roles/new" className={primaryButtonClassName}>
              Create role
            </Link>
          ) : null
        }
      />
      {loading ? <p className="mt-8 text-sm text-muted">Loading roles…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-8 text-sm leading-6 text-ink" role="alert">
            {error.message}
          </p>
        )
      ) : null}
      {data ? <RoleRows roles={data} /> : null}
    </section>
  );
}

function RoleRows({ roles }: { roles: Role[] }) {
  if (roles.length === 0) {
    return <p className="mt-8 text-sm text-muted">No roles yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
      {roles.map((role) => (
        <li key={role.id}>
          <Link
            href={`/settings/roles/${role.id}`}
            className="block px-6 py-4"
          >
            <span className="block font-medium">{role.name}</span>
            <span className="mt-1 block text-sm text-muted">
              {role.description || "No description"}
              {" · "}
              {role.permissions.length > 0
                ? role.permissions.map((permission) => permission.name).join(", ")
                : "No permissions"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
