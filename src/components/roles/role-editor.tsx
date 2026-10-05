"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { ConfirmDelete } from "@/components/form-controls";
import { RoleForm } from "@/components/roles/role-form";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { parsePermissionList, parseRoleBody } from "@/lib/directory";
import {
  ADMIN_ROLE,
  hasPermission,
  PERMISSIONS_VIEW,
  ROLES_DELETE,
  ROLES_EDIT,
  ROLES_VIEW,
} from "@/lib/session";

export function RoleEditor({ id }: { id: string }) {
  const router = useRouter();
  const { user, refresh } = useSession();
  const canView = hasPermission(user, ROLES_VIEW);
  const canEdit = hasPermission(user, ROLES_EDIT);
  const canSeeCatalog = canEdit || hasPermission(user, PERMISSIONS_VIEW);
  const roleRequest = useApi(canView ? `/api/roles/${id}` : null, parseRoleBody);
  const catalogRequest = useApi(
    canView && canSeeCatalog ? "/api/permissions" : null,
    parsePermissionList,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!canView) {
    return <Forbidden />;
  }

  if (roleRequest.loading || (canSeeCatalog && catalogRequest.loading)) {
    return <p className="text-sm text-muted">Loading role…</p>;
  }

  if (roleRequest.error?.status === 403) {
    return <Forbidden message={roleRequest.error.message} />;
  }

  if (roleRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {roleRequest.error.message}
      </p>
    );
  }

  if (!roleRequest.data) {
    return null;
  }

  const role = roleRequest.data;
  const canDelete =
    hasPermission(user, ROLES_DELETE) && role.name !== ADMIN_ROLE;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/roles/${id}`, { method: "DELETE" });

      if (user.roles.some((item) => item.id === id)) {
        await refresh();
      }

      router.push("/settings/roles");
    } catch (error) {
      setDeleteError(asApiError(error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <RoleForm
        role={role}
        editable={canEdit}
        catalog={
          canSeeCatalog && !catalogRequest.error ? catalogRequest.data : null
        }
        catalogError={
          canSeeCatalog
            ? catalogRequest.error
              ? catalogRequest.error.message
              : catalogRequest.loading
                ? "Loading permissions…"
                : null
            : null
        }
      />
      {canDelete ? (
        <div className="grid gap-3">
          {deleteError ? (
            <p className="text-sm leading-6 text-ink" role="alert">
              {deleteError}
            </p>
          ) : null}
          <ConfirmDelete
            label="Delete role"
            question="Delete this role?"
            pending={deleting}
            onConfirm={() => {
              void remove();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
