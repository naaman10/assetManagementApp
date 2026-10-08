"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/form-controls";
import { ApiRequestError, apiRequest, asApiError } from "@/lib/api-client";
import { formatBcisRef, type BcisRef } from "@/lib/bcis-refs";
import { parseBcisSubRefBody, type BcisSubRef } from "@/lib/bcis-sub-refs";

export function BcisSubRefForm({
  bcisSubRef,
  bcisRefs,
  onForbidden,
}: {
  bcisSubRef?: BcisSubRef;
  bcisRefs: BcisRef[];
  onForbidden: (message: string) => void;
}) {
  const router = useRouter();
  const creating = !bcisSubRef;
  const [code, setCode] = useState(bcisSubRef?.code ?? "");
  const [name, setName] = useState(bcisSubRef?.name ?? "");
  const [description, setDescription] = useState(bcisSubRef?.description ?? "");
  const [bcisRefId, setBcisRefId] = useState(bcisSubRef?.bcisRefId ?? "");
  const [isActive, setIsActive] = useState(bcisSubRef?.isActive ?? true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const knownParent = bcisRefs.some((bcisRef) => bcisRef.id === bcisRefId);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { code, name, description, bcisRefId, isActive };
    const payload = bcisSubRef ? updatePayload(bcisSubRef, draft) : createPayload(draft);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const saved = parseBcisSubRefBody(
        await apiRequest(
          creating ? "/api/bcis-sub-refs" : `/api/bcis-sub-refs/${bcisSubRef.id}`,
          {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      );
      router.push(`/bcis-sub-refs/${saved.id}`);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 403) {
        onForbidden(apiError.message);
        return;
      }

      setError(apiError);
      setPending(false);
    }
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={onSubmit}>
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id="bcis-sub-ref-code"
        name="code"
        label="Code"
        required
        maxLength={50}
        value={code}
        disabled={pending}
        messages={fieldErrors.code}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      <TextField
        id="bcis-sub-ref-name"
        name="name"
        label="Name"
        required
        maxLength={255}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="bcis-sub-ref-parent"
        >
          BCIS reference
        </label>
        <select
          id="bcis-sub-ref-parent"
          name="bcisRefId"
          required
          value={bcisRefId}
          disabled={pending}
          onChange={(event) => {
            setBcisRefId(event.target.value);
          }}
          className={inputClassName}
        >
          <option value="">Select a BCIS reference</option>
          {!knownParent && bcisRefId ? <option value={bcisRefId}>{bcisRefId}</option> : null}
          {bcisRefs.map((bcisRef) => (
            <option key={bcisRef.id} value={bcisRef.id}>
              {formatBcisRef(bcisRef)}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.bcisRefId} />
        {bcisRefs.length === 0 ? (
          <p className="mt-1.5 text-sm text-gray-500">No BCIS references yet.</p>
        ) : null}
      </div>
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="bcis-sub-ref-description"
        >
          Description
        </label>
        <textarea
          id="bcis-sub-ref-description"
          name="description"
          maxLength={5000}
          value={description}
          disabled={pending}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={`${inputClassName} min-h-28 py-3`}
        />
        <FieldMessages messages={fieldErrors.description} />
      </div>
      <div>
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="isActive"
            className="size-4 accent-brand-500"
            checked={isActive}
            disabled={pending}
            onChange={(event) => {
              setIsActive(event.target.checked);
            }}
          />
          Active
        </label>
        <FieldMessages messages={fieldErrors.isActive} />
      </div>
      <div>
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "Create BCIS sub reference" : "Save"}
        </button>
      </div>
    </form>
  );
}

function createPayload(draft: {
  code: string;
  name: string;
  description: string;
  bcisRefId: string;
  isActive: boolean;
}) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: emptyToNull(draft.description),
    bcisRefId: draft.bcisRefId,
    isActive: draft.isActive,
  };
}

function updatePayload(
  bcisSubRef: BcisSubRef,
  draft: {
    code: string;
    name: string;
    description: string;
    bcisRefId: string;
    isActive: boolean;
  },
) {
  const payload: {
    code?: string;
    name?: string;
    description?: string | null;
    bcisRefId?: string;
    isActive?: boolean;
  } = {};
  const code = draft.code.trim();
  const name = draft.name.trim();
  const description = emptyToNull(draft.description);

  if (code !== bcisSubRef.code) {
    payload.code = code;
  }

  if (name !== bcisSubRef.name) {
    payload.name = name;
  }

  if (description !== bcisSubRef.description) {
    payload.description = description;
  }

  if (draft.bcisRefId !== bcisSubRef.bcisRefId) {
    payload.bcisRefId = draft.bcisRefId;
  }

  if (draft.isActive !== bcisSubRef.isActive) {
    payload.isActive = draft.isActive;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
