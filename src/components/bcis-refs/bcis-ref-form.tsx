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
import { parseBcisRefBody, type BcisRef } from "@/lib/bcis-refs";

export function BcisRefForm({
  bcisRef,
  onMissing,
  onForbidden,
}: {
  bcisRef?: BcisRef;
  onMissing?: () => void;
  onForbidden: (message: string) => void;
}) {
  const router = useRouter();
  const creating = !bcisRef;
  const [code, setCode] = useState(bcisRef?.code ?? "");
  const [name, setName] = useState(bcisRef?.name ?? "");
  const [description, setDescription] = useState(bcisRef?.description ?? "");
  const [isActive, setIsActive] = useState(bcisRef?.isActive ?? true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { code, name, description, isActive };
    const payload = bcisRef ? updatePayload(bcisRef, draft) : createPayload(draft);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const saved = parseBcisRefBody(
        await apiRequest(creating ? "/api/bcis-refs" : `/api/bcis-refs/${bcisRef.id}`, {
          method: creating ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        }),
      );
      router.push(`/bcis-refs/${saved.id}`);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404 && onMissing) {
        onMissing();
        return;
      }

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
        id="bcis-ref-code"
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
        id="bcis-ref-name"
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
        <label className="block text-sm font-medium text-gray-700" htmlFor="bcis-ref-description">
          Description
        </label>
        <textarea
          id="bcis-ref-description"
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
          {pending ? "Saving…" : creating ? "Create BCIS reference" : "Save"}
        </button>
      </div>
    </form>
  );
}

function createPayload(draft: {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: emptyToNull(draft.description),
    isActive: draft.isActive,
  };
}

function updatePayload(
  bcisRef: BcisRef,
  draft: {
    code: string;
    name: string;
    description: string;
    isActive: boolean;
  },
) {
  const payload: {
    code?: string;
    name?: string;
    description?: string | null;
    isActive?: boolean;
  } = {};
  const code = draft.code.trim();
  const name = draft.name.trim();
  const description = emptyToNull(draft.description);

  if (code !== bcisRef.code) {
    payload.code = code;
  }

  if (name !== bcisRef.name) {
    payload.name = name;
  }

  if (description !== bcisRef.description) {
    payload.description = description;
  }

  if (draft.isActive !== bcisRef.isActive) {
    payload.isActive = draft.isActive;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
