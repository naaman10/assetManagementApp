"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetFinder } from "@/components/audits/asset-finder";
import {
  FormBanner,
  FieldMessages,
  PageHeading,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import {
  ApiRequestError,
  apiRequest,
  asApiError,
  useApi,
  type FieldErrors,
} from "@/lib/api-client";
import {
  AUDIT_STATUSES,
  auditStatusLabel,
  leadLabel,
  parseAuditBody,
  parseClientChoices,
  parseClientSites,
  parseLeadUsers,
  type AuditStatus,
  type FinderAsset,
} from "@/lib/audits";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function CreateAudit({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const fixedClientId = clientId || "";
  const blocked = !canView && !fixedClientId;
  const clientsRequest = useApi(
    !blocked && !fixedClientId ? "/api/clients" : null,
    parseClientChoices,
  );
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId);
  const activeClientId = fixedClientId || selectedClientId;
  const clientRequest = useApi(
    activeClientId ? `/api/clients/${activeClientId}` : null,
    parseClientSites,
  );
  const leadsRequest = useApi(blocked ? null : "/api/clients/users", parseLeadUsers);
  const [title, setTitle] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [status, setStatus] = useState<AuditStatus>("scheduled");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [leadUserId, setLeadUserId] = useState("");
  const [assets, setAssets] = useState<FinderAsset[]>([]);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const hideLead = leadsRequest.error?.status === 403;
  const clientMissing = clientRequest.error?.status === 404;

  useEffect(() => {
    if (blocked || clientMissing) {
      router.replace("/audits");
    }
  }, [blocked, clientMissing, router]);

  if (blocked || clientMissing) {
    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors = validateAudit({
      clientId: activeClientId,
      title,
      projectReference,
      startDate,
      dueDate,
    });

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = auditPayload({
      title,
      projectReference,
      status,
      description,
      startDate,
      dueDate,
      leadUserId: hideLead ? "" : leadUserId,
      assetIds: assets.map((asset) => asset.id),
    });

    setPending(true);
    setError(null);

    try {
      const audit = parseAuditBody(
        await apiRequest(`/api/clients/${activeClientId}/audits`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      router.push(`/audits/${audit.id}`);
    } catch (caught) {
      setError(asApiError(caught));
      setPending(false);
    }
  }

  return (
    <section>
      <PageHeading title="New audit" />
      <form className="mt-6 grid max-w-4xl gap-5" onSubmit={onSubmit}>
        <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
        {fixedClientId ? (
          <div>
            <p className="text-sm font-medium text-gray-700">Client</p>
            <p className="mt-1.5 text-sm font-medium text-gray-800">
              {clientRequest.data?.name ?? (clientRequest.loading ? "Loading client…" : "Client")}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="audit-client">
              Client
            </label>
            <select
              id="audit-client"
              required
              value={selectedClientId}
              disabled={pending || clientsRequest.loading}
              onChange={(event) => {
                setSelectedClientId(event.target.value);
                setAssets([]);
              }}
              className={inputClassName}
            >
              <option value="">Choose a client</option>
              {(clientsRequest.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <FieldMessages messages={fieldErrors.clientId} />
            {clientsRequest.error ? (
              <p className="mt-1.5 text-sm text-error-500" role="alert">
                {clientsRequest.error.message}
              </p>
            ) : null}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="audit-title"
            label="Title"
            required
            value={title}
            disabled={pending}
            messages={fieldErrors.title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="audit-status">
              Status
            </label>
            <select
              id="audit-status"
              value={status}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.value;
                if ((AUDIT_STATUSES as readonly string[]).includes(next)) {
                  setStatus(next as AuditStatus);
                }
              }}
              className={inputClassName}
            >
              {AUDIT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {auditStatusLabel(value)}
                </option>
              ))}
            </select>
            <FieldMessages messages={fieldErrors.status} />
          </div>
        </div>
        <TextField
          id="audit-reference"
          label="Project reference"
          required
          value={projectReference}
          disabled={pending}
          messages={fieldErrors.projectReference}
          onChange={(event) => {
            setProjectReference(event.target.value);
          }}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="audit-description">
            Description
          </label>
          <textarea
            id="audit-description"
            value={description}
            disabled={pending}
            rows={4}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
          />
          <FieldMessages messages={fieldErrors.description} />
        </div>
        <div className={`grid gap-5 ${hideLead ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          <TextField
            id="audit-start"
            label="Start date"
            type="date"
            value={startDate}
            disabled={pending}
            messages={fieldErrors.startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
            }}
          />
          <TextField
            id="audit-due"
            label="Due date"
            type="date"
            value={dueDate}
            disabled={pending}
            messages={fieldErrors.dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
            }}
          />
          {hideLead ? null : (
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="audit-lead">
                Lead
              </label>
              <select
                id="audit-lead"
                value={leadUserId}
                disabled={pending || leadsRequest.loading}
                onChange={(event) => {
                  setLeadUserId(event.target.value);
                }}
                className={inputClassName}
              >
                <option value="">No lead</option>
                {(leadsRequest.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {leadLabel(person)}
                  </option>
                ))}
              </select>
              <FieldMessages messages={fieldErrors.leadUserId} />
              {leadsRequest.error && leadsRequest.error.status !== 403 ? (
                <p className="mt-1.5 text-sm text-error-500" role="alert">
                  {leadsRequest.error.message}
                </p>
              ) : null}
            </div>
          )}
        </div>
        {clientRequest.error && !clientMissing ? (
          <p className="text-sm text-error-500" role="alert">
            {clientRequest.error.message}
          </p>
        ) : null}
        {activeClientId && clientRequest.data ? (
          <AssetFinder
            clientName={clientRequest.data.name}
            sites={clientRequest.data.sites}
            chosen={assets}
            onChange={setAssets}
          />
        ) : activeClientId && clientRequest.loading ? (
          <p className="text-sm text-gray-500">Loading client…</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClassName}>
            {pending ? "Saving…" : "Create audit"}
          </button>
          <Link href="/audits" className={secondaryButtonClassName}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function validateAudit(draft: {
  clientId: string;
  title: string;
  projectReference: string;
  startDate: string;
  dueDate: string;
}): FieldErrors | null {
  const errors: FieldErrors = {};

  if (!draft.clientId) {
    errors.clientId = ["Choose a client."];
  }

  if (!draft.title.trim()) {
    errors.title = ["Enter a title."];
  }

  if (!draft.projectReference.trim()) {
    errors.projectReference = ["Enter a project reference."];
  }

  if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
    errors.dueDate = ["The due date must be on or after the start date."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function auditPayload(draft: {
  title: string;
  projectReference: string;
  status: AuditStatus;
  description: string;
  startDate: string;
  dueDate: string;
  leadUserId: string;
  assetIds: string[];
}) {
  const payload: Record<string, string | string[]> = {
    title: draft.title.trim(),
    projectReference: draft.projectReference.trim(),
    status: draft.status,
    assetIds: draft.assetIds,
  };
  const description = draft.description.trim();

  if (description) {
    payload.description = description;
  }

  if (draft.startDate) {
    payload.startDate = draft.startDate;
  }

  if (draft.dueDate) {
    payload.dueDate = draft.dueDate;
  }

  if (draft.leadUserId) {
    payload.leadUserId = draft.leadUserId;
  }

  return payload;
}
