"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseClientBody } from "@/lib/clients";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function EditClient({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canView = hasPermission(user, CLIENTS_VIEW);
  const request = useApi(
    canEdit && canView ? `/api/clients/${id}` : null,
    parseClientBody,
  );
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/clients");
    }
  }, [missing, router]);

  if (!canEdit) {
    return <Forbidden />;
  }

  if (!canView) {
    return <Forbidden />;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading client…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  if (!request.data) {
    return null;
  }

  return (
    <ClientForm
      client={request.data}
      onSaved={() => {
        router.push(`/clients/${id}`);
      }}
    />
  );
}
