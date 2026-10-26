"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
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
import { UserMultiPicker } from "@/components/projects/user-multi-picker";
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
  parseClientChoices,
  parseClientSites,
  parseLeadUsers,
  parseProjectBody,
} from "@/lib/projects";
import { CLIENTS_VIEW, PROJECT_TYPES_VIEW, hasPermission } from "@/lib/session";

const STEPS = [
  { id: 1, label: "Client" },
  { id: 2, label: "Details" },
  { id: 3, label: "Due date" },
  { id: 4, label: "Assignees" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function CreateProject({
  clientId,
  embedded = false,
  onCancel,
}: {
  clientId?: string;
  /** When true, omit the page heading (e.g. shown inside a modal). */
  embedded?: boolean;
  onCancel?: () => void;
}) {
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
  const usersRequest = useApi(blocked ? null : "/api/clients/users", parseLeadUsers);
  const [step, setStep] = useState<StepId>(1);
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId);
  const activeClientId = fixedClientId || selectedClientId;
  const fixedClientRequest = useApi(
    fixedClientId ? `/api/clients/${fixedClientId}` : null,
    parseClientSites,
  );
  const [title, setTitle] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leadUserId, setLeadUserId] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const hideUsers = usersRequest.error?.status === 403;
  const clientMissing = fixedClientRequest.error?.status === 404;
  const activeTypes = (typesRequest.data ?? []).filter((type) => type.isActive);
  const users = usersRequest.data ?? [];
  const clientLabel = fixedClientId
    ? (fixedClientRequest.data?.name ??
      (fixedClientRequest.loading ? "Loading client…" : "Client"))
    : ((clientsRequest.data ?? []).find((client) => client.id === selectedClientId)?.name ??
      "Client");

  useEffect(() => {
    if (blocked || clientMissing) {
      router.replace("/projects");
    }
  }, [blocked, clientMissing, router]);

  if (blocked || clientMissing) {
    return null;
  }

  function validateStep(current: StepId): FieldErrors | null {
    const errors: FieldErrors = {};

    if (current === 1 && !activeClientId) {
      errors.clientId = ["Choose a client."];
    }

    if (current === 2) {
      if (!title.trim()) {
        errors.title = ["Enter a title."];
      }

      if (!projectReference.trim()) {
        errors.projectReference = ["Enter a project reference."];
      }

      if (!canPickTypes || !projectTypeId) {
        errors.projectTypeId = ["Choose a project type."];
      }
    }

    if (current === 3 && !dueDate) {
      errors.dueDate = ["Choose a due date."];
    }

    if (current === 4 && !hideUsers && !leadUserId) {
      errors.leadUserId = ["Choose an assignee."];
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  function goNext() {
    const localErrors = validateStep(step);

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    setError(null);

    if (step < 4) {
      setStep((current) => (current + 1) as StepId);
    }
  }

  function goBack() {
    setError(null);

    if (step > 1) {
      setStep((current) => (current - 1) as StepId);
    }
  }

  async function onCreate() {
    for (const current of [1, 2, 3, 4] as const) {
      const localErrors = validateStep(current);

      if (localErrors) {
        setError(new ApiRequestError(400, "Invalid request", localErrors));
        setStep(current);
        return;
      }
    }

    setPending(true);
    setError(null);

    try {
      const project = parseProjectBody(
        await apiRequest(`/api/clients/${activeClientId}/projects`, {
          method: "POST",
          body: JSON.stringify(
            projectPayload({
              title,
              projectReference,
              projectTypeId,
              description,
              dueDate,
              memberIds: hideUsers ? [] : memberIds,
              leadUserId: hideUsers ? "" : leadUserId,
            }),
          ),
        }),
      );
      router.push(`/projects/${project.id}`);
    } catch (caught) {
      setError(asApiError(caught));
      setPending(false);
    }
  }

  function cancel() {
    if (onCancel) {
      onCancel();
      return;
    }

    router.push("/projects");
  }

  return (
    <section>
      {embedded ? null : <PageHeading title="New project" />}
      <WizardSteps current={step} className={embedded ? "mt-0" : "mt-6"} />
      <div className="mt-6 grid max-w-2xl gap-5">
        <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />

        {step === 1 ? (
          fixedClientId ? (
            <div>
              <p className="text-sm font-medium text-gray-700">Client</p>
              <p className="mt-1.5 text-sm font-medium text-gray-800">{clientLabel}</p>
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
          )
        ) : null}

        {step === 2 ? (
          <>
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
              {canPickTypes &&
              !typesRequest.loading &&
              !typesRequest.error &&
              activeTypes.length === 0 ? (
                <p className="mt-1.5 text-sm text-error-500" role="alert">
                  No active project types are available.
                </p>
              ) : null}
            </div>
            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="project-description"
              >
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
          </>
        ) : null}

        {step === 3 ? (
          <TextField
            id="project-due"
            label="Due date"
            type="date"
            required
            value={dueDate}
            disabled={pending}
            messages={fieldErrors.dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
            }}
          />
        ) : null}

        {step === 4 ? (
          hideUsers ? (
            <p className="text-sm text-gray-500">
              You do not have access to choose assignees. You can still create the project.
            </p>
          ) : (
            <>
              <div>
                <label
                  id="project-assignee-label"
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="project-assignee"
                >
                  Lead
                </label>
                <div className="mt-1.5">
                  <AssetTypePicker
                    id="project-assignee"
                    types={users.map((person) => ({
                      id: person.id,
                      name: person.name ?? person.email,
                      code: "",
                    }))}
                    value={leadUserId}
                    disabled={pending}
                    loading={usersRequest.loading}
                    showCode={false}
                    inlineMenu
                    listLabel="Assignees"
                    placeholder="Choose a lead"
                    searchPlaceholder="Search people"
                    loadingLabel="Loading people…"
                    onChange={setLeadUserId}
                  />
                </div>
                <FieldMessages messages={fieldErrors.leadUserId} />
              </div>
              <div>
                <label
                  id="project-members-label"
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="project-members"
                >
                  Members
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Optional. Choose people who will work on this project.
                </p>
                <div className="mt-1.5">
                  <UserMultiPicker
                    id="project-members"
                    users={users}
                    value={memberIds}
                    disabled={pending}
                    loading={usersRequest.loading}
                    onChange={setMemberIds}
                  />
                </div>
                <FieldMessages messages={fieldErrors.memberIds} />
              </div>
              {usersRequest.error && usersRequest.error.status !== 403 ? (
                <p className="text-sm text-error-500" role="alert">
                  {usersRequest.error.message}
                </p>
              ) : null}
            </>
          )
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step > 1 ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={pending}
              onClick={goBack}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={pending}
              onClick={cancel}
            >
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={pending || (step === 2 && (!canPickTypes || activeTypes.length === 0))}
              onClick={goNext}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={pending}
              onClick={() => {
                void onCreate();
              }}
            >
              {pending ? "Saving…" : "Create project"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function WizardSteps({
  current,
  className = "mt-6",
}: {
  current: StepId;
  className?: string;
}) {
  return (
    <ol className={`${className} flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 pb-4`}>
      {STEPS.map((item) => {
        const active = item.id === current;
        const complete = item.id < current;

        return (
          <li
            key={item.id}
            className={`flex items-center gap-2 text-sm ${
              active
                ? "font-medium text-brand-500"
                : complete
                  ? "font-medium text-gray-800"
                  : "text-gray-500"
            }`}
          >
            <span
              className={`grid size-6 place-items-center rounded-full text-xs ${
                active
                  ? "bg-brand-500 text-white"
                  : complete
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {item.id}
            </span>
            {item.label}
          </li>
        );
      })}
    </ol>
  );
}

function projectPayload(draft: {
  title: string;
  projectReference: string;
  projectTypeId: string;
  description: string;
  dueDate: string;
  memberIds: string[];
  leadUserId: string;
}) {
  const payload: Record<string, string | string[]> = {
    title: draft.title.trim(),
    projectReference: draft.projectReference.trim(),
    projectTypeId: draft.projectTypeId,
    status: "scheduled",
    dueDate: draft.dueDate,
    memberIds: draft.memberIds,
    assetIds: [],
  };
  const description = draft.description.trim();

  if (description) {
    payload.description = description;
  }

  if (draft.leadUserId) {
    payload.leadUserId = draft.leadUserId;
  }

  return payload;
}
