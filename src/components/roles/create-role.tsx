"use client";

import { Forbidden } from "@/components/forbidden";
import { RoleForm } from "@/components/roles/role-form";
import { useSession } from "@/components/session-provider";
import { useApi } from "@/lib/api-client";
import { parsePermissionList } from "@/lib/directory";
import { hasPermission, ROLES_CREATE } from "@/lib/session";

export function CreateRole() {
  const { user } = useSession();
  const canCreate = hasPermission(user, ROLES_CREATE);
  const catalogRequest = useApi(
    canCreate ? "/api/permissions" : null,
    parsePermissionList,
  );

  if (!canCreate) {
    return <Forbidden />;
  }

  if (catalogRequest.loading) {
    return <p className="text-sm text-muted">Loading permissions…</p>;
  }

  return (
    <RoleForm
      editable
      catalog={catalogRequest.error ? null : catalogRequest.data}
      catalogError={
        catalogRequest.error
          ? catalogRequest.error.message
          : catalogRequest.loading
            ? "Loading permissions…"
            : null
      }
    />
  );
}
