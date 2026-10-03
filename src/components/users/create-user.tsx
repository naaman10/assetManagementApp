"use client";

import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { UserForm } from "@/components/users/user-form";
import { useApi } from "@/lib/api-client";
import { parseRoleList } from "@/lib/directory";
import { hasPermission, USERS_CREATE } from "@/lib/session";

export function CreateUser() {
  const { user } = useSession();
  const canCreate = hasPermission(user, USERS_CREATE);
  const rolesRequest = useApi(canCreate ? "/api/roles" : null, parseRoleList);

  if (!canCreate) {
    return <Forbidden />;
  }

  if (rolesRequest.loading) {
    return <p className="text-sm text-muted">Loading roles…</p>;
  }

  return (
    <UserForm
      roles={rolesRequest.error ? null : rolesRequest.data}
      rolesError={
        rolesRequest.error
          ? rolesRequest.error.message
          : rolesRequest.loading
            ? "Loading roles…"
            : null
      }
    />
  );
}
