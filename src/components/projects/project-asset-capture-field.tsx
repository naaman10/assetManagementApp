"use client";

import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { ParentAssetPicker } from "@/components/assets/parent-asset-picker";
import { assetStatusLabel } from "@/components/assets/asset-table";
import {
  FieldMessages,
  inputClassName,
} from "@/components/form-controls";
import { Nrm3ClassificationPicker } from "@/components/nrm3-classifications/nrm3-classification-picker";
import { UserMultiPicker } from "@/components/projects/user-multi-picker";
import { useApi } from "@/lib/api-client";
import { parseAssetTypeList } from "@/lib/asset-types";
import { parseLocationBody, locationLabel } from "@/lib/locations";
import { parseMaintenanceTypeList } from "@/lib/maintenance-types";
import { parseNrm3ClassificationList } from "@/lib/nrm3-classifications";
import {
  LONG_TEXT_KEYS,
  READ_ONLY_CAPTURE_KEYS,
  SURVEY_CONDITION_CODES,
  SURVEY_STATUSES,
  datetimeLocalValue,
  surveyStatusLabel,
  type CaptureField,
  type CaptureSource,
} from "@/lib/project-asset-capture";
import { parseLeadUsers, type ProjectUser } from "@/lib/projects";
import { ASSET_STATUSES, parseAssetList } from "@/lib/sites";
import { parseWorkOrderList } from "@/lib/work-orders";

export function ProjectAssetCaptureField({
  field,
  source,
  value,
  disabled,
  messages,
  assetId,
  locationId,
  onChange,
}: {
  field: CaptureField;
  source: CaptureSource;
  value: unknown;
  disabled: boolean;
  messages?: string[];
  assetId: string;
  locationId: string;
  onChange: (value: unknown) => void;
}) {
  const id = `capture-${source}-${field.key}`;
  const readOnly = READ_ONLY_CAPTURE_KEYS.has(field.key) || disabled;
  const label = (
    <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
      {field.label}
      {field.required && !READ_ONLY_CAPTURE_KEYS.has(field.key) ? (
        <span className="text-error-500"> *</span>
      ) : null}
    </label>
  );

  if (field.key === "locationId") {
    return (
      <LocationDisplay
        id={id}
        label={field.label}
        locationId={typeof value === "string" && value ? value : locationId}
        messages={messages}
      />
    );
  }

  if (field.key === "referenceNumber") {
    return null;
  }

  if (field.type === "boolean") {
    return (
      <div>
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
          <input
            id={id}
            type="checkbox"
            className="size-4 accent-brand-500"
            checked={Boolean(value)}
            disabled={readOnly}
            onChange={(event) => {
              onChange(event.target.checked);
            }}
          />
          <span>
            {field.label}
            {field.required ? <span className="text-error-500"> *</span> : null}
          </span>
        </label>
        <FieldMessages messages={messages} />
      </div>
    );
  }

  if (field.type === "select" || isKnownSelectKey(field.key)) {
    const options = selectOptionsForKey(field.key, source);

    return (
      <div>
        {label}
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={readOnly}
          className={inputClassName}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldMessages messages={messages} />
      </div>
    );
  }

  if (field.type === "referenceList" || field.key === "surveyorUserIds") {
    return (
      <SurveyorPicker
        id={id}
        label={field.label}
        required={field.required}
        value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []}
        disabled={readOnly}
        messages={messages}
        onChange={onChange}
      />
    );
  }

  if (field.type === "reference" || isKnownReferenceKey(field.key)) {
    return (
      <ReferenceField
        id={id}
        field={field}
        value={typeof value === "string" ? value : ""}
        disabled={readOnly}
        messages={messages}
        assetId={assetId}
        locationId={locationId}
        onChange={onChange}
      />
    );
  }

  if (field.type === "datetime") {
    return (
      <div>
        {label}
        <input
          id={id}
          type="datetime-local"
          value={typeof value === "string" ? value : datetimeLocalValue(value)}
          disabled={readOnly}
          className={inputClassName}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <FieldMessages messages={messages} />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {label}
        <input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          disabled={readOnly}
          className={inputClassName}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <FieldMessages messages={messages} />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <input
          id={id}
          type="number"
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          disabled={readOnly}
          className={inputClassName}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <FieldMessages messages={messages} />
      </div>
    );
  }

  if (LONG_TEXT_KEYS.has(field.key)) {
    return (
      <div>
        {label}
        <textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={readOnly}
          rows={4}
          className={`${inputClassName} h-auto min-h-28 py-3`}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <FieldMessages messages={messages} />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        id={id}
        type="text"
        value={typeof value === "string" ? value : value == null ? "" : String(value)}
        disabled={readOnly}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function ReferenceField({
  id,
  field,
  value,
  disabled,
  messages,
  assetId,
  locationId,
  onChange,
}: {
  id: string;
  field: CaptureField;
  value: string;
  disabled: boolean;
  messages?: string[];
  assetId: string;
  locationId: string;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-error-500"> *</span> : null}
    </label>
  );

  if (field.key === "assetTypeId") {
    return (
      <AssetTypeReference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        onChange={onChange}
      />
    );
  }

  if (field.key === "maintenanceTypeId") {
    return (
      <MaintenanceTypeReference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        onChange={onChange}
      />
    );
  }

  if (field.key === "nrm3Code") {
    return (
      <Nrm3Reference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        onChange={onChange}
      />
    );
  }

  if (field.key === "parentAssetId") {
    return (
      <ParentAssetReference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        locationId={locationId}
        assetId={assetId}
        onChange={onChange}
      />
    );
  }

  if (field.key === "performedBy") {
    return (
      <UserReference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        listLabel="People"
        onChange={onChange}
      />
    );
  }

  if (field.key === "workOrderId") {
    return (
      <WorkOrderReference
        id={id}
        label={label}
        value={value}
        disabled={disabled}
        messages={messages}
        assetId={assetId}
        onChange={onChange}
      />
    );
  }

  return (
    <div>
      {label}
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function AssetTypeReference({
  id,
  label,
  value,
  disabled,
  messages,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  onChange: (value: unknown) => void;
}) {
  const request = useApi("/api/asset-types", parseAssetTypeList);
  const types = (request.data ?? [])
    .filter((type) => type.isActive || type.id === value)
    .map((type) => ({ id: type.id, name: type.name, code: type.code }));

  return (
    <div>
      {label}
      <AssetTypePicker
        id={id}
        types={types}
        value={value}
        disabled={disabled}
        loading={request.loading}
        onChange={(next) => {
          onChange(next);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function MaintenanceTypeReference({
  id,
  label,
  value,
  disabled,
  messages,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  onChange: (value: unknown) => void;
}) {
  const request = useApi("/api/maintenance-types", parseMaintenanceTypeList);
  const types = (request.data ?? [])
    .filter((type) => type.isActive || type.id === value)
    .map((type) => ({ id: type.id, name: type.name, code: type.code }));

  return (
    <div>
      {label}
      <AssetTypePicker
        id={id}
        types={types}
        value={value}
        disabled={disabled}
        loading={request.loading}
        showCode={false}
        listLabel="Maintenance types"
        onChange={(next) => {
          onChange(next);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function Nrm3Reference({
  id,
  label,
  value,
  disabled,
  messages,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  onChange: (value: unknown) => void;
}) {
  const request = useApi("/api/nrm3-classifications", parseNrm3ClassificationList);

  return (
    <div>
      {label}
      <Nrm3ClassificationPicker
        id={id}
        items={request.data ?? []}
        value={value}
        disabled={disabled}
        loading={request.loading}
        clearLabel="None"
        onChange={(next) => {
          onChange(next);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function ParentAssetReference({
  id,
  label,
  value,
  disabled,
  messages,
  locationId,
  assetId,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  locationId: string;
  assetId: string;
  onChange: (value: unknown) => void;
}) {
  const request = useApi(
    locationId ? `/api/locations/${locationId}/assets` : null,
    parseAssetList,
  );
  const assets = (request.data?.assets ?? [])
    .filter((asset) => asset.id !== assetId)
    .map((asset) => ({
      id: asset.id,
      tag: asset.tag,
      assetName: asset.assetName,
    }));

  return (
    <div>
      {label}
      <ParentAssetPicker
        id={id}
        assets={assets}
        value={value}
        disabled={disabled}
        loading={request.loading}
        clearLabel="None"
        onChange={(next) => {
          onChange(next);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function UserReference({
  id,
  label,
  value,
  disabled,
  messages,
  listLabel,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  listLabel: string;
  onChange: (value: unknown) => void;
}) {
  const request = useApi("/api/clients/users", parseLeadUsers);
  const types = (request.data ?? []).map((user) => ({
    id: user.id,
    name: user.name ?? user.email,
    code: user.email,
  }));

  return (
    <div>
      {label}
      <AssetTypePicker
        id={id}
        types={types}
        value={value}
        disabled={disabled}
        loading={request.loading}
        showCode={false}
        listLabel={listLabel}
        searchPlaceholder="Search people"
        loadingLabel="Loading people…"
        clearLabel="None"
        onChange={(next) => {
          onChange(next);
        }}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function WorkOrderReference({
  id,
  label,
  value,
  disabled,
  messages,
  assetId,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  messages?: string[];
  assetId: string;
  onChange: (value: unknown) => void;
}) {
  const request = useApi(
    assetId ? `/api/assets/${assetId}/work-orders` : null,
    parseWorkOrderList,
  );
  const orders = request.data?.workOrders ?? [];

  return (
    <div>
      {label}
      <select
        id={id}
        value={value}
        disabled={disabled || request.loading}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">None</option>
        {orders.map((order) => (
          <option key={order.id} value={order.id}>
            {order.reference} · {order.title}
          </option>
        ))}
      </select>
      <FieldMessages messages={messages} />
    </div>
  );
}

function SurveyorPicker({
  id,
  label,
  required,
  value,
  disabled,
  messages,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  value: string[];
  disabled: boolean;
  messages?: string[];
  onChange: (value: unknown) => void;
}) {
  const request = useApi("/api/clients/users", parseLeadUsers);
  const users: ProjectUser[] = request.data ?? [];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
        {required ? <span className="text-error-500"> *</span> : null}
      </label>
      <div className="mt-1.5">
        <UserMultiPicker
          id={id}
          users={users}
          value={value}
          disabled={disabled}
          loading={request.loading}
          placeholder="Add surveyors"
          listLabel="Surveyors"
          emptyLabel="No surveyors selected."
          onChange={(ids) => {
            onChange(ids);
          }}
        />
      </div>
      <FieldMessages messages={messages} />
    </div>
  );
}

function LocationDisplay({
  id,
  label,
  locationId,
  messages,
}: {
  id: string;
  label: string;
  locationId: string;
  messages?: string[];
}) {
  const request = useApi(
    locationId ? `/api/locations/${locationId}` : null,
    parseLocationBody,
  );
  const display = request.data
    ? locationLabel(request.data)
    : request.loading
      ? "Loading…"
      : locationId || "—";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={display}
        disabled
        readOnly
        className={inputClassName}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

function isKnownSelectKey(key: string): boolean {
  return key === "status" || key === "conditionCode";
}

function isKnownReferenceKey(key: string): boolean {
  return (
    key === "assetTypeId" ||
    key === "maintenanceTypeId" ||
    key === "nrm3Code" ||
    key === "parentAssetId" ||
    key === "performedBy" ||
    key === "workOrderId"
  );
}

function selectOptionsForKey(
  key: string,
  source: CaptureSource,
): Array<{ value: string; label: string }> {
  if (key === "status") {
    if (source === "survey_record") {
      return SURVEY_STATUSES.map((status) => ({
        value: status,
        label: surveyStatusLabel(status),
      }));
    }

    return ASSET_STATUSES.map((status) => ({
      value: status,
      label: assetStatusLabel(status),
    }));
  }

  if (key === "conditionCode") {
    return SURVEY_CONDITION_CODES.map((code) => ({ value: code, label: code }));
  }

  return [];
}
