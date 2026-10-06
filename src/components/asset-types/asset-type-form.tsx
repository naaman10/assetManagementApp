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
import {
  CLASSIFICATIONS,
  classificationLabel,
  parseAssetTypeBody,
  type AssetType,
  type ClassificationType,
} from "@/lib/asset-types";

export function AssetTypeForm({
  assetType,
  assetTypes,
  onMissing,
  onForbidden,
}: {
  assetType: AssetType;
  assetTypes: AssetType[];
  onMissing: () => void;
  onForbidden: (message: string) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(assetType.code);
  const [name, setName] = useState(assetType.name);
  const [description, setDescription] = useState(assetType.description ?? "");
  const [classificationType, setClassificationType] = useState<ClassificationType>(
    assetType.classificationType,
  );
  const [parentId, setParentId] = useState(assetType.parentId ?? "");
  const [isActive, setIsActive] = useState(assetType.isActive);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const excluded = excludedParentIds(assetTypes, assetType.id);
  const parentOptions = assetTypes
    .filter((item) => !excluded.has(item.id))
    .sort((left, right) => left.code.localeCompare(right.code));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = updatePayload(assetType, {
      code,
      name,
      description,
      classificationType,
      parentId,
      isActive,
    });

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseAssetTypeBody(
        await apiRequest(`/api/asset-types/${assetType.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      );
      router.push(`/asset-types/${assetType.id}`);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
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
        id="asset-type-code"
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
        id="asset-type-name"
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
          htmlFor="asset-type-description"
        >
          Description
        </label>
        <textarea
          id="asset-type-description"
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
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="asset-type-classification"
        >
          Classification
        </label>
        <select
          id="asset-type-classification"
          name="classificationType"
          value={classificationType}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            if ((CLASSIFICATIONS as readonly string[]).includes(next)) {
              setClassificationType(next as ClassificationType);
            }
          }}
          className={inputClassName}
        >
          {CLASSIFICATIONS.map((value) => (
            <option key={value} value={value}>
              {classificationLabel(value)}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.classificationType} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="asset-type-parent">
          Parent
        </label>
        <select
          id="asset-type-parent"
          name="parentId"
          value={parentId}
          disabled={pending}
          onChange={(event) => {
            setParentId(event.target.value);
          }}
          className={inputClassName}
        >
          <option value="">No parent</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.code} · {option.name}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.parentId} />
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function excludedParentIds(assetTypes: AssetType[], id: string): Set<string> {
  const children = new Map<string, string[]>();

  for (const assetType of assetTypes) {
    if (!assetType.parentId) {
      continue;
    }

    const list = children.get(assetType.parentId) ?? [];
    list.push(assetType.id);
    children.set(assetType.parentId, list);
  }

  const excluded = new Set<string>([id]);
  const pending = [id];

  while (pending.length > 0) {
    const current = pending.pop();

    if (!current) {
      continue;
    }

    for (const childId of children.get(current) ?? []) {
      if (excluded.has(childId)) {
        continue;
      }

      excluded.add(childId);
      pending.push(childId);
    }
  }

  return excluded;
}

function updatePayload(
  assetType: AssetType,
  draft: {
    code: string;
    name: string;
    description: string;
    classificationType: ClassificationType;
    parentId: string;
    isActive: boolean;
  },
) {
  const payload: {
    code?: string;
    name?: string;
    description?: string | null;
    classificationType?: ClassificationType;
    parentId?: string | null;
    isActive?: boolean;
  } = {};
  const code = draft.code.trim();
  const name = draft.name.trim();
  const description = emptyToNull(draft.description);
  const parentId = draft.parentId === "" ? null : draft.parentId;

  if (code !== assetType.code) {
    payload.code = code;
  }

  if (name !== assetType.name) {
    payload.name = name;
  }

  if (description !== assetType.description) {
    payload.description = description;
  }

  if (draft.classificationType !== assetType.classificationType) {
    payload.classificationType = draft.classificationType;
  }

  if (parentId !== assetType.parentId) {
    payload.parentId = parentId;
  }

  if (draft.isActive !== assetType.isActive) {
    payload.isActive = draft.isActive;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
