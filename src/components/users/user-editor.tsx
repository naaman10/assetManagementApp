"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import {
  ConfirmDelete,
  PageHeading,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { UserForm } from "@/components/users/user-form";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseRoleList,
  parseUserBody,
  type User,
} from "@/lib/directory";
import {
  hasPermission,
  USERS_DELETE,
  USERS_EDIT,
  USERS_VIEW,
} from "@/lib/session";

export function UserEditor({ id }: { id: string }) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const canView = hasPermission(sessionUser, USERS_VIEW);
  const canEdit = hasPermission(sessionUser, USERS_EDIT);
  const canDelete =
    hasPermission(sessionUser, USERS_DELETE) && id !== sessionUser.id;
  const userRequest = useApi(canView ? `/api/users/${id}` : null, parseUserBody);
  const rolesRequest = useApi(canEdit ? "/api/roles" : null, parseRoleList);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savedUser, setSavedUser] = useState<User | null>(null);

  if (!canView) {
    return <Forbidden />;
  }

  if (userRequest.loading || (canEdit && rolesRequest.loading)) {
    return <p className="text-sm text-muted">Loading user…</p>;
  }

  if (userRequest.error?.status === 403) {
    return <Forbidden message={userRequest.error.message} />;
  }

  if (userRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {userRequest.error.message}
      </p>
    );
  }

  if (!userRequest.data) {
    return null;
  }

  const account =
    savedUser?.id === userRequest.data.id ? savedUser : userRequest.data;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/users/${id}`, { method: "DELETE" });
      router.push("/settings/users");
    } catch (error) {
      setDeleteError(asApiError(error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-8">
      {canEdit ? (
        <UserForm
          user={account}
          roles={rolesRequest.error ? null : rolesRequest.data}
          rolesError={
            rolesRequest.error
              ? rolesRequest.error.message
              : rolesRequest.loading
                ? "Loading roles…"
                : null
          }
          onSaved={setSavedUser}
        />
      ) : (
        <UserSummary user={account} />
      )}
      {canDelete ? (
        <div className="grid gap-3">
          {deleteError ? (
            <p className="text-sm leading-6 text-ink" role="alert">
              {deleteError}
            </p>
          ) : null}
          <ConfirmDelete
            label="Delete user"
            question="Delete this user?"
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

function UserSummary({ user }: { user: User }) {
  const picture = safePicture(user.picture);

  return (
    <section>
      <PageHeading title={user.email} />
      <dl className="mt-8 grid gap-4 rounded-card bg-surface p-6 shadow-card">
        {picture ? (
          <div>
            {/* Profile pictures are remote Auth0 URLs, so they are not run through the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={picture}
              alt=""
              className="size-16 rounded-full object-cover"
            />
          </div>
        ) : null}
        <SummaryItem label="Name" value={user.name || "No name"} />
        <SummaryItem
          label="Roles"
          value={
            user.roles.length > 0
              ? user.roles.map((role) => role.name).join(", ")
              : "No roles"
          }
        />
        <SummaryItem
          label="Permissions"
          value={
            user.permissions.length > 0
              ? user.permissions.join(", ")
              : "No permissions"
          }
        />
        <SummaryItem label="Status" value={user.disabled ? "Disabled" : "Active"} />
      </dl>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function safePicture(picture: string | null): string | null {
  if (!picture) {
    return null;
  }

  try {
    const url = new URL(picture);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
