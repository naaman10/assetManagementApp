"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/form-controls";
import { Nrm3ClassificationPicker } from "@/components/nrm3-classifications/nrm3-classification-picker";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  parseNrm3ClassificationBody,
  parseNrm3ClassificationList,
  type Nrm3Classification,
} from "@/lib/nrm3-classifications";

const LEVELS = [1, 2, 3, 4, 5] as const;
const DEFAULT_SOURCE_VERSION = "2026-01";

export function Nrm3ClassificationForm({
  classification,
  onMissing,
  onForbidden,
}: {
  classification?: Nrm3Classification;
  onMissing?: () => void;
  onForbidden: (message: string) => void;
}) {
  const router = useRouter();
  const creating = !classification;
  const catalogRequest = useApi("/api/nrm3-classifications", parseNrm3ClassificationList);
  const [code, setCode] = useState(classification?.code ?? "");
  const [name, setName] = useState(classification?.name ?? "");
  const [level, setLevel] = useState(classification ? String(classification.level) : "1");
  const [parentCode, setParentCode] = useState(classification?.parentCode ?? "");
  const [maintainableAssetDescription, setMaintainableAssetDescription] = useState(
    classification?.maintainableAssetDescription ?? "",
  );
  const [renewalUom, setRenewalUom] = useState(classification?.renewalUom ?? "");
  const [maintenanceUom, setMaintenanceUom] = useState(classification?.maintenanceUom ?? "");
  const [productMaterialType, setProductMaterialType] = useState(
    classification?.productMaterialType ?? "",
  );
  const [workPackage, setWorkPackage] = useState(classification?.workPackage ?? "");
  const [sourceVersion, setSourceVersion] = useState(
    classification?.sourceVersion ?? DEFAULT_SOURCE_VERSION,
  );
  const [sourceRow, setSourceRow] = useState(
    classification?.sourceRow == null ? "" : String(classification.sourceRow),
  );
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const excludeCodes = useMemo(() => {
    if (!classification || !catalogRequest.data) {
      return undefined;
    }

    return descendantCodes(catalogRequest.data, classification.code);
  }, [catalogRequest.data, classification]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLevel = Number(level);
    const parsedSourceRow = readOptionalInteger(sourceRow);

    if (!LEVELS.includes(parsedLevel as (typeof LEVELS)[number])) {
      setError(
        new ApiRequestError(400, "Invalid request", {
          level: ["Choose a level from 1 to 5."],
        }),
      );
      return;
    }

    if (parsedSourceRow === false) {
      setError(
        new ApiRequestError(400, "Invalid request", {
          sourceRow: ["Enter a whole number."],
        }),
      );
      return;
    }

    const draft = {
      code,
      name,
      level: parsedLevel,
      parentCode,
      maintainableAssetDescription,
      renewalUom,
      maintenanceUom,
      productMaterialType,
      workPackage,
      sourceVersion,
      sourceRow: parsedSourceRow,
    };
    const payload = classification
      ? updatePayload(classification, draft)
      : createPayload(draft);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const saved = parseNrm3ClassificationBody(
        await apiRequest(
          creating
            ? "/api/nrm3-classifications"
            : `/api/nrm3-classifications/${encodeURIComponent(classification.code)}`,
          {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      );
      router.push(`/nrm3-classifications/${encodeURIComponent(saved.code)}`);
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
      {creating ? (
        <TextField
          id="nrm3-code"
          name="code"
          label="Code"
          required
          maxLength={100}
          value={code}
          disabled={pending}
          messages={fieldErrors.code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
      ) : (
        <div>
          <p className="text-sm font-medium text-gray-700">Code</p>
          <p className="mt-1.5 text-sm text-gray-800">{classification.code}</p>
        </div>
      )}
      <TextField
        id="nrm3-name"
        name="name"
        label="Name"
        required
        maxLength={5000}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="nrm3-level">
          Level
        </label>
        <select
          id="nrm3-level"
          name="level"
          required
          value={level}
          disabled={pending}
          onChange={(event) => {
            setLevel(event.target.value);
          }}
          className={inputClassName}
        >
          {LEVELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.level} />
      </div>
      <div>
        <label
          id="nrm3-parent-label"
          className="block text-sm font-medium text-gray-700"
          htmlFor="nrm3-parent"
        >
          Parent
        </label>
        <Nrm3ClassificationPicker
          id="nrm3-parent"
          items={catalogRequest.data ?? []}
          value={parentCode}
          disabled={pending}
          loading={catalogRequest.loading}
          clearLabel="No parent (root)"
          excludeCodes={excludeCodes}
          onChange={setParentCode}
        />
        <FieldMessages messages={fieldErrors.parentCode} />
        {catalogRequest.error ? (
          <p className="mt-1.5 text-sm text-error-500" role="alert">
            {catalogRequest.error.message}
          </p>
        ) : null}
      </div>
      <TextField
        id="nrm3-maintainable"
        name="maintainableAssetDescription"
        label="Maintainable asset description"
        maxLength={5000}
        value={maintainableAssetDescription}
        disabled={pending}
        messages={fieldErrors.maintainableAssetDescription}
        onChange={(event) => {
          setMaintainableAssetDescription(event.target.value);
        }}
      />
      <TextField
        id="nrm3-renewal-uom"
        name="renewalUom"
        label="Renewal UOM"
        maxLength={5000}
        value={renewalUom}
        disabled={pending}
        messages={fieldErrors.renewalUom}
        onChange={(event) => {
          setRenewalUom(event.target.value);
        }}
      />
      <TextField
        id="nrm3-maintenance-uom"
        name="maintenanceUom"
        label="Maintenance UOM"
        maxLength={5000}
        value={maintenanceUom}
        disabled={pending}
        messages={fieldErrors.maintenanceUom}
        onChange={(event) => {
          setMaintenanceUom(event.target.value);
        }}
      />
      <TextField
        id="nrm3-product-material"
        name="productMaterialType"
        label="Product / material type"
        maxLength={5000}
        value={productMaterialType}
        disabled={pending}
        messages={fieldErrors.productMaterialType}
        onChange={(event) => {
          setProductMaterialType(event.target.value);
        }}
      />
      <TextField
        id="nrm3-work-package"
        name="workPackage"
        label="Work package"
        maxLength={5000}
        value={workPackage}
        disabled={pending}
        messages={fieldErrors.workPackage}
        onChange={(event) => {
          setWorkPackage(event.target.value);
        }}
      />
      <TextField
        id="nrm3-source-version"
        name="sourceVersion"
        label="Source version"
        required
        maxLength={100}
        value={sourceVersion}
        disabled={pending}
        messages={fieldErrors.sourceVersion}
        onChange={(event) => {
          setSourceVersion(event.target.value);
        }}
      />
      <TextField
        id="nrm3-source-row"
        name="sourceRow"
        label="Source row"
        type="number"
        step={1}
        inputMode="numeric"
        value={sourceRow}
        disabled={pending}
        messages={fieldErrors.sourceRow}
        onChange={(event) => {
          setSourceRow(event.target.value);
        }}
      />
      <div>
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "Create classification" : "Save"}
        </button>
      </div>
    </form>
  );
}

type Draft = {
  code: string;
  name: string;
  level: number;
  parentCode: string;
  maintainableAssetDescription: string;
  renewalUom: string;
  maintenanceUom: string;
  productMaterialType: string;
  workPackage: string;
  sourceVersion: string;
  sourceRow: number | null;
};

function createPayload(draft: Draft) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    level: draft.level,
    parentCode: emptyToNull(draft.parentCode),
    maintainableAssetDescription: emptyToNull(draft.maintainableAssetDescription),
    renewalUom: emptyToNull(draft.renewalUom),
    maintenanceUom: emptyToNull(draft.maintenanceUom),
    productMaterialType: emptyToNull(draft.productMaterialType),
    workPackage: emptyToNull(draft.workPackage),
    sourceVersion: draft.sourceVersion.trim() || DEFAULT_SOURCE_VERSION,
    sourceRow: draft.sourceRow,
  };
}

function updatePayload(classification: Nrm3Classification, draft: Draft) {
  const payload: Record<string, string | number | null> = {};
  const name = draft.name.trim();
  const parentCode = emptyToNull(draft.parentCode);
  const maintainableAssetDescription = emptyToNull(draft.maintainableAssetDescription);
  const renewalUom = emptyToNull(draft.renewalUom);
  const maintenanceUom = emptyToNull(draft.maintenanceUom);
  const productMaterialType = emptyToNull(draft.productMaterialType);
  const workPackage = emptyToNull(draft.workPackage);
  const sourceVersion = draft.sourceVersion.trim();

  if (name !== classification.name) {
    payload.name = name;
  }

  if (draft.level !== classification.level) {
    payload.level = draft.level;
  }

  if (parentCode !== classification.parentCode) {
    payload.parentCode = parentCode;
  }

  if (maintainableAssetDescription !== classification.maintainableAssetDescription) {
    payload.maintainableAssetDescription = maintainableAssetDescription;
  }

  if (renewalUom !== classification.renewalUom) {
    payload.renewalUom = renewalUom;
  }

  if (maintenanceUom !== classification.maintenanceUom) {
    payload.maintenanceUom = maintenanceUom;
  }

  if (productMaterialType !== classification.productMaterialType) {
    payload.productMaterialType = productMaterialType;
  }

  if (workPackage !== classification.workPackage) {
    payload.workPackage = workPackage;
  }

  if (sourceVersion !== classification.sourceVersion) {
    payload.sourceVersion = sourceVersion;
  }

  if (draft.sourceRow !== classification.sourceRow) {
    payload.sourceRow = draft.sourceRow;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function descendantCodes(rows: Nrm3Classification[], rootCode: string): Set<string> {
  const children = new Map<string | null, string[]>();

  for (const row of rows) {
    const key = row.parentCode;
    const list = children.get(key);

    if (list) {
      list.push(row.code);
    } else {
      children.set(key, [row.code]);
    }
  }

  const excluded = new Set<string>([rootCode]);
  const stack = [rootCode];

  while (stack.length > 0) {
    const code = stack.pop()!;

    for (const child of children.get(code) ?? []) {
      if (!excluded.has(child)) {
        excluded.add(child);
        stack.push(child);
      }
    }
  }

  return excluded;
}

function readOptionalInteger(value: string): number | null | false {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return false;
  }

  return Number(trimmed);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
