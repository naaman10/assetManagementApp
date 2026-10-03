"use client";

import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
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
      {loading ? <p className="mt-8 text-sm text-muted">Loading users…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-8 text-sm leading-6 text-ink" role="alert">
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
    return <p className="mt-8 text-sm text-muted">No users yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
      {users.map((user) => (
        <li key={user.id}>
          <Link
            href={`/settings/users/${user.id}`}
            className="flex items-center justify-between gap-4 px-6 py-4"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{user.email}</span>
              <span className="mt-1 block truncate text-sm text-muted">
                {user.name || "No name"}
                {" · "}
                {user.roles.length > 0
                  ? user.roles.map((role) => role.name).join(", ")
                  : "No roles"}
              </span>
            </span>
            {user.disabled ? (
              <span className="shrink-0 rounded-full bg-surface-warm px-3 py-1 text-sm">
                Disabled
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
