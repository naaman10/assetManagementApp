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
import { parseMaintenanceTypeBody, type MaintenanceType } from "@/lib/maintenance-types";

export function MaintenanceTypeForm({
  maintenanceType,
  onMissing,
  onForbidden,
}: {
  maintenanceType?: MaintenanceType;
  onMissing?: () => void;
  onForbidden: (message: string) => void;
}) {
  const router = useRouter();
  const creating = !maintenanceType;
  const [code, setCode] = useState(maintenanceType?.code ?? "");
  const [name, setName] = useState(maintenanceType?.name ?? "");
  const [description, setDescription] = useState(maintenanceType?.description ?? "");
  const [sortOrder, setSortOrder] = useState(
    maintenanceType ? String(maintenanceType.sortOrder) : "0",
  );
  const [isActive, setIsActive] = useState(maintenanceType?.isActive ?? true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedSortOrder = readSortOrder(sortOrder);

    if (parsedSortOrder === null) {
      setError(
        new ApiRequestError(400, "Invalid request", {
          sortOrder: ["Enter a whole number."],
        }),
      );
      return;
    }

    const draft = { code, name, description, sortOrder: parsedSortOrder, isActive };
    const payload = maintenanceType
      ? updatePayload(maintenanceType, draft)
      : createPayload(draft);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const saved = parseMaintenanceTypeBody(
        await apiRequest(
          creating ? "/api/maintenance-types" : `/api/maintenance-types/${maintenanceType.id}`,
          {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      );
      router.push(`/maintenance-types/${saved.id}`);
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
        id="maintenance-type-code"
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
        id="maintenance-type-name"
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
          htmlFor="maintenance-type-description"
        >
          Description
        </label>
        <textarea
          id="maintenance-type-description"
          name="description"
          value={description}
          disabled={pending}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={`${inputClassName} min-h-28 py-3`}
        />
        <FieldMessages messages={fieldErrors.description} />
      </div>
      <TextField
        id="maintenance-type-sort-order"
        name="sortOrder"
        label="Sort order"
        type="number"
        step={1}
        inputMode="numeric"
        value={sortOrder}
        disabled={pending}
        messages={fieldErrors.sortOrder}
        onChange={(event) => {
          setSortOrder(event.target.value);
        }}
      />
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
          {pending ? "Saving…" : creating ? "Create maintenance type" : "Save"}
        </button>
      </div>
    </form>
  );
}

function createPayload(draft: {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}) {
  const payload: {
    code: string;
    name: string;
    description: string | null;
    sortOrder?: number;
    isActive?: boolean;
  } = {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: emptyToNull(draft.description),
  };

  if (draft.sortOrder !== 0) {
    payload.sortOrder = draft.sortOrder;
  }

  if (!draft.isActive) {
    payload.isActive = false;
  }

  return payload;
}

function updatePayload(
  maintenanceType: MaintenanceType,
  draft: {
    code: string;
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  },
) {
  const payload: {
    code?: string;
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  } = {};
  const code = draft.code.trim();
  const name = draft.name.trim();
  const description = emptyToNull(draft.description);

  if (code !== maintenanceType.code) {
    payload.code = code;
  }

  if (name !== maintenanceType.name) {
    payload.name = name;
  }

  if (description !== maintenanceType.description) {
    payload.description = description;
  }

  if (draft.sortOrder !== maintenanceType.sortOrder) {
    payload.sortOrder = draft.sortOrder;
  }

  if (draft.isActive !== maintenanceType.isActive) {
    payload.isActive = draft.isActive;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function readSortOrder(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return 0;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
