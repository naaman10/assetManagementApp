"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { ClientLogo } from "@/components/clients/client-logo";
import { Forbidden } from "@/components/forbidden";
import {
  ConfirmDelete,
  FormBanner,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { logoFileProblem, parseClientBody, type Client } from "@/lib/clients";
import {
  CLIENTS_DELETE,
  CLIENTS_EDIT,
  CLIENTS_VIEW,
  hasPermission,
} from "@/lib/session";

export function EditClient({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canDelete = hasPermission(user, CLIENTS_DELETE);
  const request = useApi(
    canEdit && canView ? `/api/clients/${id}` : null,
    parseClientBody,
  );
  const [saved, setSaved] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const missing = request.error?.status === 404;
  const client = saved?.id === request.data?.id ? saved : request.data;

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

  if (!client) {
    return null;
  }

  async function reloadLogo(): Promise<string | null> {
    try {
      const body = await apiRequest(`/api/clients/${id}`);
      const next = parseClientBody(body);
      setSaved(next);
      return next.logoUrl;
    } catch (error) {
      if (asApiError(error).status === 404) {
        router.replace("/clients");
      }

      throw error;
    }
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiRequest(`/api/clients/${id}`, { method: "DELETE" });
      router.push("/clients");
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        router.replace("/clients");
        return;
      }

      setDeleteError(apiError.message);
      setDeleting(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-10">
      <ClientForm
        client={client}
        leading={
          <div className="mt-8 grid gap-4">
            <ClientLogo
              name={client.name}
              logoUrl={client.logoUrl}
              size="detail"
              onReload={reloadLogo}
            />
            <LogoUpload
              clientId={client.id}
              onSaved={setSaved}
              onMissing={() => {
                router.replace("/clients");
              }}
            />
          </div>
        }
        onSaved={() => {
          router.push(`/clients/${id}`);
        }}
      />
      {canDelete ? (
        <div className="grid gap-3">
          {deleteError ? (
            <p className="text-sm leading-6 text-ink" role="alert">
              {deleteError}
            </p>
          ) : null}
          <ConfirmDelete
            label="Delete client"
            question="Delete this client? The logo and contacts will be deleted too."
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

function LogoUpload({
  clientId,
  onSaved,
  onMissing,
}: {
  clientId: string;
  onSaved: (client: Client) => void;
  onMissing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function upload() {
    if (!file) {
      setMessage("A logo image is required.");
      return;
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const problem = logoFileProblem(bytes, file.size);

    if (problem) {
      setMessage(problem);
      return;
    }

    const body = new FormData();
    body.set("logo", file);
    setPending(true);
    setMessage(null);

    try {
      const response = await apiRequest(`/api/clients/${clientId}/logo`, {
        method: "PUT",
        body,
      });
      onSaved(parseClientBody(response));
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      const apiError = asApiError(error);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setMessage(
        apiError.message === "Logo storage is unavailable."
          ? "The logo could not be saved."
          : apiError.message,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <FormBanner message={message} />
      <div className="flex flex-wrap items-center gap-3">
        <label className={secondaryButtonClassName}>
          Choose logo
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage(null);
            }}
          />
        </label>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={() => {
            void upload();
          }}
        >
          {pending ? "Uploading…" : "Upload logo"}
        </button>
      </div>
      {file ? <p className="text-sm text-muted">{file.name}</p> : null}
    </div>
  );
}
