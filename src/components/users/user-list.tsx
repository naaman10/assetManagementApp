"use client";

import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  DataTable,
  PageHeading,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseUserList, type User } from "@/lib/directory";
import { hasPermission, USERS_CREATE, USERS_VIEW } from "@/lib/session";

export function UserList() {
  const { user } = useSession();
  const canView = hasPermission(user, USERS_VIEW);
  const canCreate = hasPermission(user, USERS_CREATE);
  const { data, error, loading } = useApi(
    canView ? "/api/users" : null,
    parseUserList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="Users"
        action={
          canCreate ? (
            <Link href="/settings/users/new" className={primaryButtonClassName}>
              Create user
            </Link>
          ) : null
        }
      />
      {loading ? <p className="mt-6 text-sm text-gray-500">Loading users…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(error).message}
          </p>
        )
      ) : null}
      {data ? <UserRows users={data} /> : null}
    </section>
  );
}

function UserRows({ users }: { users: User[] }) {
  if (users.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No users yet.</p>;
  }

  return (
    <DataTable columns={["Email", "Name", "Roles", "Status"]}>
      {users.map((user) => (
        <tr key={user.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link
              href={`/settings/users/${user.id}`}
              className="text-sm font-medium text-gray-800"
            >
              {user.email}
            </Link>
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">{user.name || "No name"}</td>
          <td className="px-5 py-4 text-sm text-gray-500">
            {user.roles.length > 0
              ? user.roles.map((role) => role.name).join(", ")
              : "No roles"}
          </td>
          <td className="px-5 py-4">
            <Badge tone={user.disabled ? "error" : "success"}>
              {user.disabled ? "Disabled" : "Active"}
            </Badge>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
