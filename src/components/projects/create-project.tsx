"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetFinder } from "@/components/projects/asset-finder";
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
import { parseProjectTypeList } from "@/lib/project-types";
import {
  PROJECT_STATUSES,
  leadLabel,
  parseClientChoices,
  parseClientSites,
  parseLeadUsers,
  parseProjectBody,
  projectStatusLabel,
  type FinderAsset,
  type ProjectStatus,
} from "@/lib/projects";
import { CLIENTS_VIEW, PROJECT_TYPES_VIEW, hasPermission } from "@/lib/session";

export function CreateProject({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canPickTypes = hasPermission(user, PROJECT_TYPES_VIEW);
  const fixedClientId = clientId || "";
  const blocked = !canView && !fixedClientId;
  const clientsRequest = useApi(
    !blocked && !fixedClientId ? "/api/clients" : null,
    parseClientChoices,
  );
  const typesRequest = useApi(canPickTypes ? "/api/project-types" : null, parseProjectTypeList);
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId);
  const activeClientId = fixedClientId || selectedClientId;
  const clientRequest = useApi(
    activeClientId ? `/api/clients/${activeClientId}` : null,
    parseClientSites,
  );
  const leadsRequest = useApi(blocked ? null : "/api/clients/users", parseLeadUsers);
  const [title, setTitle] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("scheduled");
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
  const activeTypes = (typesRequest.data ?? []).filter((type) => type.isActive);

  useEffect(() => {
    if (blocked || clientMissing) {
      router.replace("/projects");
    }
  }, [blocked, clientMissing, router]);

  if (blocked || clientMissing) {
    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors = validateProject({
      clientId: activeClientId,
      title,
      projectReference,
      projectTypeId,
      canPickTypes,
      startDate,
      dueDate,
    });

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = projectPayload({
      title,
      projectReference,
      projectTypeId,
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
      const project = parseProjectBody(
        await apiRequest(`/api/clients/${activeClientId}/projects`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      router.push(`/projects/${project.id}`);
    } catch (caught) {
      setError(asApiError(caught));
      setPending(false);
    }
  }

  return (
    <section>
      <PageHeading title="New project" />
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
            <label className="block text-sm font-medium text-gray-700" htmlFor="project-client">
              Client
            </label>
            <select
              id="project-client"
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
            id="project-title"
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
            <label className="block text-sm font-medium text-gray-700" htmlFor="project-status">
              Status
            </label>
            <select
              id="project-status"
              value={status}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.value;
                if ((PROJECT_STATUSES as readonly string[]).includes(next)) {
                  setStatus(next as ProjectStatus);
                }
              }}
              className={inputClassName}
            >
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {projectStatusLabel(value)}
                </option>
              ))}
            </select>
            <FieldMessages messages={fieldErrors.status} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="project-reference"
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
            <label className="block text-sm font-medium text-gray-700" htmlFor="project-type">
              Project type
            </label>
            <select
              id="project-type"
              required
              value={projectTypeId}
              disabled={pending || !canPickTypes || typesRequest.loading}
              onChange={(event) => {
                setProjectTypeId(event.target.value);
              }}
              className={inputClassName}
            >
              <option value="">
                {typesRequest.loading ? "Loading project types…" : "Choose a project type"}
              </option>
              {activeTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.code})
                </option>
              ))}
            </select>
            <FieldMessages messages={fieldErrors.projectTypeId} />
            {!canPickTypes ? (
              <p className="mt-1.5 text-sm text-error-500" role="alert">
                Choosing a project type needs access to project types.
              </p>
            ) : null}
            {canPickTypes && typesRequest.error ? (
              <p className="mt-1.5 text-sm text-error-500" role="alert">
                {typesRequest.error.message}
              </p>
            ) : null}
            {canPickTypes && !typesRequest.loading && !typesRequest.error && activeTypes.length === 0 ? (
              <p className="mt-1.5 text-sm text-error-500" role="alert">
                No active project types are available.
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="project-description">
            Description
          </label>
          <textarea
            id="project-description"
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
            id="project-start"
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
            id="project-due"
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
              <label className="block text-sm font-medium text-gray-700" htmlFor="project-lead">
                Lead
              </label>
              <select
                id="project-lead"
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
          <button
            type="submit"
            disabled={pending || !canPickTypes || activeTypes.length === 0}
            className={primaryButtonClassName}
          >
            {pending ? "Saving…" : "Create project"}
          </button>
          <Link href="/projects" className={secondaryButtonClassName}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function validateProject(draft: {
  clientId: string;
  title: string;
  projectReference: string;
  projectTypeId: string;
  canPickTypes: boolean;
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

  if (!draft.canPickTypes || !draft.projectTypeId) {
    errors.projectTypeId = ["Choose a project type."];
  }

  if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
    errors.dueDate = ["The due date must be on or after the start date."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function projectPayload(draft: {
  title: string;
  projectReference: string;
  projectTypeId: string;
  status: ProjectStatus;
  description: string;
  startDate: string;
  dueDate: string;
  leadUserId: string;
  assetIds: string[];
}) {
  const payload: Record<string, string | string[]> = {
    title: draft.title.trim(),
    projectReference: draft.projectReference.trim(),
    projectTypeId: draft.projectTypeId,
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
