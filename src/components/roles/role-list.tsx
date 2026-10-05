"use client";

import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { DataTable, PageHeading, primaryButtonClassName } from "@/components/form-controls";
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
      {loading ? <p className="mt-6 text-sm text-gray-500">Loading roles…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
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
    return <p className="mt-6 text-sm text-gray-500">No roles yet.</p>;
  }

  return (
    <DataTable columns={["Role", "Description", "Permissions"]}>
      {roles.map((role) => (
        <tr key={role.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link
              href={`/settings/roles/${role.id}`}
              className="text-sm font-medium text-gray-800"
            >
              {role.name}
            </Link>
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">
            {role.description || "No description"}
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">
            {role.permissions.length > 0
              ? role.permissions.map((permission) => permission.name).join(", ")
              : "No permissions"}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
