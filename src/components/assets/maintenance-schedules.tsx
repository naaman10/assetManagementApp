"use client";

import { useState } from "react";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { Modal } from "@/components/modal";
import {
  Badge,
  DataTable,
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { ApiRequestError, apiRequest, asApiError, useApi, type FieldErrors } from "@/lib/api-client";
import { parseMaintenanceTypeList, type MaintenanceType } from "@/lib/maintenance-types";
import {
  FREQUENCY_UNITS,
  formatFrequency,
  parseMaintenanceScheduleBody,
  type FrequencyUnit,
  type MaintenanceSchedule,
  type MaintenanceScheduleList,
  type ScheduleMaintenanceType,
} from "@/lib/maintenance-schedules";

export function MaintenanceSchedulePanel({
  assetId,
  schedules,
  loading,
  error,
  canEdit,
  canPickTypes,
  onReload,
  onAssetMissing,
}: {
  assetId: string;
  schedules: MaintenanceScheduleList | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  canPickTypes: boolean;
  onReload: () => Promise<void>;
  onAssetMissing: () => void;
}) {
  const [open, setOpen] = useState<MaintenanceSchedule | "create" | null>(null);
  const [openFor, setOpenFor] = useState(assetId);
  const showAdd = canEdit && canPickTypes;

  if (openFor !== assetId) {
    setOpenFor(assetId);
    setOpen(null);
  }

  if (!schedules) {
    if (loading) {
      return <p className="text-sm text-muted">Loading maintenance schedules…</p>;
    }

    if (error) {
      return (
        <p className="text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      );
    }

    return null;
  }

  return (
    <section>
      {error ? (
        <p className="mb-4 text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {showAdd && !open ? (
        <div className="flex justify-end">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setOpen("create");
            }}
          >
            Add maintenance schedule
          </button>
        </div>
      ) : null}
      {schedules.maintenanceSchedules.length === 0 ? (
        <p className="text-sm text-gray-500">No maintenance schedules yet.</p>
      ) : (
        <DataTable columns={["Name", "Type", "Frequency", "Next due", "Status"]}>
          {schedules.maintenanceSchedules.map((schedule) => (
            <tr key={schedule.id} className="hover:bg-gray-50">
              <td className="px-5 py-4">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-gray-800"
                  onClick={() => {
                    setOpen(schedule);
                  }}
                >
                  {schedule.name}
                </button>
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{schedule.maintenanceType.name}</td>
              <td className="px-5 py-4 text-sm text-gray-500">
                {formatFrequency(schedule.frequencyValue, schedule.frequencyUnit)}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{schedule.nextDueDate ?? "—"}</td>
              <td className="px-5 py-4">
                <Badge tone={schedule.isActive ? "success" : "light"}>
                  {schedule.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {open ? (
        <Modal
          title={open === "create" ? "Add maintenance schedule" : open.name}
          onClose={() => {
            setOpen(null);
          }}
        >
          <ScheduleForm
            key={open === "create" ? "create" : open.id}
            assetId={assetId}
            schedule={open === "create" ? null : open}
            canEdit={canEdit}
            canPickTypes={canPickTypes}
            onCancel={() => {
              setOpen(null);
            }}
            onSaved={async () => {
              setOpen(null);
              await onReload();
            }}
            onMissing={async () => {
              setOpen(null);
              await onReload();
            }}
            onAssetMissing={onAssetMissing}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function ScheduleForm({
  assetId,
  schedule,
  canEdit,
  canPickTypes,
  onCancel,
  onSaved,
  onMissing,
  onAssetMissing,
}: {
  assetId: string;
  schedule: MaintenanceSchedule | null;
  canEdit: boolean;
  canPickTypes: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onMissing: () => Promise<void>;
  onAssetMissing: () => void;
}) {
  const creating = !schedule;
  const typesRequest = useApi(
    canPickTypes ? "/api/maintenance-types" : null,
    parseMaintenanceTypeList,
  );
  const [name, setName] = useState(schedule?.name ?? "");
  const [maintenanceTypeId, setMaintenanceTypeId] = useState(schedule?.maintenanceTypeId ?? "");
  const [frequencyValue, setFrequencyValue] = useState(
    schedule ? String(schedule.frequencyValue) : "",
  );
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit | "">(
    schedule?.frequencyUnit ?? "",
  );
  const [description, setDescription] = useState(schedule?.description ?? "");
  const [startDate, setStartDate] = useState(schedule?.startDate ?? "");
  const [lastCompletedDate, setLastCompletedDate] = useState(schedule?.lastCompletedDate ?? "");
  const [nextDueDate, setNextDueDate] = useState(schedule?.nextDueDate ?? "");
  const [estimatedDuration, setEstimatedDuration] = useState(
    schedule?.estimatedDurationMinutes == null ? "" : String(schedule.estimatedDurationMinutes),
  );
  const [estimatedCost, setEstimatedCost] = useState(
    schedule?.estimatedCost == null ? "" : String(schedule.estimatedCost),
  );
  const [autoWorkorder, setAutoWorkorder] = useState(schedule?.autoWorkorder ?? false);
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const typeOptions = maintenanceTypeOptions(typesRequest.data ?? [], schedule);
  const disabled = pending || !canEdit;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const draft = {
      name,
      maintenanceTypeId,
      frequencyValue,
      frequencyUnit,
      description,
      startDate,
      lastCompletedDate,
      nextDueDate,
      estimatedDuration,
      estimatedCost,
      autoWorkorder,
      isActive,
    };
    const localErrors = validateSchedule(draft, creating || canPickTypes);

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = schedule
      ? updatePayload(schedule, draft, canPickTypes)
      : createPayload(draft);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseMaintenanceScheduleBody(
        await apiRequest(
          creating
            ? `/api/assets/${assetId}/maintenance-schedules`
            : `/api/maintenance-schedules/${schedule.id}`,
          {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      );
      await onSaved();
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        if (creating) {
          onAssetMissing();
        } else {
          await onMissing();
        }
        return;
      }

      setError(apiError);
      setPending(false);
    }
  }

  const fields = (
    <div className="grid gap-5">
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id="schedule-name"
        name="name"
        label="Name"
        required={canEdit}
        maxLength={255}
        value={name}
        disabled={disabled}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {canPickTypes ? (
        <div>
          <label
            id="schedule-type-label"
            className="block text-sm font-medium text-gray-700"
            htmlFor="schedule-type"
          >
            Maintenance type
          </label>
          <AssetTypePicker
            id="schedule-type"
            types={typeOptions}
            value={maintenanceTypeId}
            disabled={disabled}
            loading={typesRequest.loading}
            showCode={false}
            listLabel="Maintenance types"
            onChange={setMaintenanceTypeId}
          />
          {typesRequest.error ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {typesRequest.error.message}
            </p>
          ) : null}
          <FieldMessages messages={fieldErrors.maintenanceTypeId} />
        </div>
      ) : schedule ? (
        <div>
          <p className="text-sm font-medium text-gray-700">Maintenance type</p>
          <p className="mt-1.5 text-sm text-gray-800">{schedule.maintenanceType.name}</p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="schedule-frequency"
          name="frequencyValue"
          label="Frequency"
          type="number"
          min={1}
          step={1}
          required={canEdit}
          value={frequencyValue}
          disabled={disabled}
          messages={fieldErrors.frequencyValue}
          onChange={(event) => {
            setFrequencyValue(event.target.value);
          }}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="schedule-unit">
            Unit
          </label>
          <select
            id="schedule-unit"
            name="frequencyUnit"
            value={frequencyUnit}
            required={canEdit}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.value;
              setFrequencyUnit(isFrequencyUnit(next) ? next : "");
            }}
            className={inputClassName}
          >
            <option value="">Choose a unit</option>
            {FREQUENCY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <FieldMessages messages={fieldErrors.frequencyUnit} />
        </div>
      </div>
      <div>
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="schedule-description"
        >
          Description
        </label>
        <textarea
          id="schedule-description"
          name="description"
          value={description}
          disabled={disabled}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className={`${inputClassName} min-h-28 py-3`}
        />
        <FieldMessages messages={fieldErrors.description} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          id="schedule-start"
          name="startDate"
          label="Start date"
          type="date"
          value={startDate}
          disabled={disabled}
          messages={fieldErrors.startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
          }}
        />
        <TextField
          id="schedule-last-completed"
          name="lastCompletedDate"
          label="Last completed"
          type="date"
          value={lastCompletedDate}
          disabled={disabled}
          messages={fieldErrors.lastCompletedDate}
          onChange={(event) => {
            setLastCompletedDate(event.target.value);
          }}
        />
        <TextField
          id="schedule-next-due"
          name="nextDueDate"
          label="Next due"
          type="date"
          value={nextDueDate}
          disabled={disabled}
          messages={fieldErrors.nextDueDate}
          onChange={(event) => {
            setNextDueDate(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="schedule-duration"
          name="estimatedDurationMinutes"
          label="Estimated duration (minutes)"
          type="number"
          min={0}
          step={1}
          value={estimatedDuration}
          disabled={disabled}
          messages={fieldErrors.estimatedDurationMinutes}
          onChange={(event) => {
            setEstimatedDuration(event.target.value);
          }}
        />
        <TextField
          id="schedule-cost"
          name="estimatedCost"
          label="Estimated cost"
          inputMode="decimal"
          value={estimatedCost}
          disabled={disabled}
          messages={fieldErrors.estimatedCost}
          onChange={(event) => {
            setEstimatedCost(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="autoWorkorder"
              className="size-4 accent-brand-500"
              checked={autoWorkorder}
              disabled={disabled}
              onChange={(event) => {
                setAutoWorkorder(event.target.checked);
              }}
            />
            Auto work order
          </label>
          <FieldMessages messages={fieldErrors.autoWorkorder} />
        </div>
        <div>
          <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              className="size-4 accent-brand-500"
              checked={isActive}
              disabled={disabled}
              onChange={(event) => {
                setIsActive(event.target.checked);
              }}
            />
            Active
          </label>
          <FieldMessages messages={fieldErrors.isActive} />
        </div>
      </div>
    </div>
  );

  if (!canEdit) {
    return <div className="grid gap-5">{fields}</div>;
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      {fields}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "Add maintenance schedule" : "Save"}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type ScheduleDraft = {
  name: string;
  maintenanceTypeId: string;
  frequencyValue: string;
  frequencyUnit: FrequencyUnit | "";
  description: string;
  startDate: string;
  lastCompletedDate: string;
  nextDueDate: string;
  estimatedDuration: string;
  estimatedCost: string;
  autoWorkorder: boolean;
  isActive: boolean;
};

type ParsedSchedule = {
  name: string;
  maintenanceTypeId: string;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  description: string | null;
  startDate: string | null;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  estimatedDurationMinutes: number | null;
  estimatedCost: number | null;
  autoWorkorder: boolean;
  isActive: boolean;
};

function validateSchedule(draft: ScheduleDraft, requireType: boolean): FieldErrors | null {
  const errors: FieldErrors = {};
  const name = draft.name.trim();

  if (!name) {
    errors.name = ["Enter a name."];
  } else if (name.length > 255) {
    errors.name = ["Enter a name up to 255 characters."];
  }

  if (requireType && !draft.maintenanceTypeId) {
    errors.maintenanceTypeId = ["Choose a maintenance type."];
  }

  if (!positiveInteger(draft.frequencyValue)) {
    errors.frequencyValue = ["Enter a whole number greater than 0."];
  }

  if (!draft.frequencyUnit) {
    errors.frequencyUnit = ["Choose a unit."];
  }

  if (!validDate(draft.startDate)) {
    errors.startDate = ["Enter a date."];
  }

  if (!validDate(draft.lastCompletedDate)) {
    errors.lastCompletedDate = ["Enter a date."];
  }

  if (!validDate(draft.nextDueDate)) {
    errors.nextDueDate = ["Enter a date."];
  }

  if (draft.estimatedDuration.trim() && !nonNegativeInteger(draft.estimatedDuration)) {
    errors.estimatedDurationMinutes = ["Enter a whole number."];
  }

  if (draft.estimatedCost.trim() && !validCost(draft.estimatedCost)) {
    errors.estimatedCost = ["Enter a cost with at most 2 decimal places."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function createPayload(draft: ScheduleDraft): ParsedSchedule {
  const parsed = parsedDraft(draft);

  return {
    name: parsed.name,
    maintenanceTypeId: parsed.maintenanceTypeId,
    frequencyValue: parsed.frequencyValue,
    frequencyUnit: parsed.frequencyUnit,
    description: parsed.description,
    ...(parsed.startDate ? { startDate: parsed.startDate } : {}),
    ...(parsed.lastCompletedDate ? { lastCompletedDate: parsed.lastCompletedDate } : {}),
    ...(parsed.nextDueDate ? { nextDueDate: parsed.nextDueDate } : {}),
    ...(parsed.estimatedDurationMinutes != null
      ? { estimatedDurationMinutes: parsed.estimatedDurationMinutes }
      : {}),
    ...(parsed.estimatedCost != null ? { estimatedCost: parsed.estimatedCost } : {}),
    autoWorkorder: parsed.autoWorkorder,
    isActive: parsed.isActive,
  } as ParsedSchedule;
}

function updatePayload(
  schedule: MaintenanceSchedule,
  draft: ScheduleDraft,
  includeType: boolean,
): Partial<ParsedSchedule> | null {
  const parsed = parsedDraft(draft);
  const payload: Partial<ParsedSchedule> = {};

  if (parsed.name !== schedule.name) {
    payload.name = parsed.name;
  }

  if (includeType && parsed.maintenanceTypeId !== schedule.maintenanceTypeId) {
    payload.maintenanceTypeId = parsed.maintenanceTypeId;
  }

  if (parsed.frequencyValue !== schedule.frequencyValue) {
    payload.frequencyValue = parsed.frequencyValue;
  }

  if (parsed.frequencyUnit !== schedule.frequencyUnit) {
    payload.frequencyUnit = parsed.frequencyUnit;
  }

  if (parsed.description !== schedule.description) {
    payload.description = parsed.description;
  }

  if (parsed.startDate !== schedule.startDate) {
    payload.startDate = parsed.startDate;
  }

  if (parsed.lastCompletedDate !== schedule.lastCompletedDate) {
    payload.lastCompletedDate = parsed.lastCompletedDate;
  }

  if (parsed.nextDueDate !== schedule.nextDueDate) {
    payload.nextDueDate = parsed.nextDueDate;
  }

  if (parsed.estimatedDurationMinutes !== schedule.estimatedDurationMinutes) {
    payload.estimatedDurationMinutes = parsed.estimatedDurationMinutes;
  }

  if (parsed.estimatedCost !== schedule.estimatedCost) {
    payload.estimatedCost = parsed.estimatedCost;
  }

  if (parsed.autoWorkorder !== schedule.autoWorkorder) {
    payload.autoWorkorder = parsed.autoWorkorder;
  }

  if (parsed.isActive !== schedule.isActive) {
    payload.isActive = parsed.isActive;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function parsedDraft(draft: ScheduleDraft): ParsedSchedule {
  const frequency = positiveInteger(draft.frequencyValue);
  const duration = draft.estimatedDuration.trim() ? nonNegativeInteger(draft.estimatedDuration) : null;
  const cost = draft.estimatedCost.trim() ? validCost(draft.estimatedCost) : null;

  return {
    name: draft.name.trim(),
    maintenanceTypeId: draft.maintenanceTypeId,
    frequencyValue: frequency ?? 0,
    frequencyUnit: draft.frequencyUnit || "days",
    description: emptyToNull(draft.description),
    startDate: emptyToNull(draft.startDate),
    lastCompletedDate: emptyToNull(draft.lastCompletedDate),
    nextDueDate: emptyToNull(draft.nextDueDate),
    estimatedDurationMinutes: duration,
    estimatedCost: cost,
    autoWorkorder: draft.autoWorkorder,
    isActive: draft.isActive,
  };
}

function maintenanceTypeOptions(
  types: MaintenanceType[],
  schedule: MaintenanceSchedule | null,
): ScheduleMaintenanceType[] {
  const active = types.filter((type) => type.isActive);

  if (schedule && !active.some((type) => type.id === schedule.maintenanceTypeId)) {
    return [...active, schedule.maintenanceType];
  }

  return active;
}

function positiveInteger(value: string): number | null {
  const parsed = wholeNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: string): number | null {
  const parsed = wholeNumber(value);
  return parsed != null && parsed >= 0 ? parsed : null;
}

function wholeNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

function validCost(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

function validDate(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFrequencyUnit(value: string): value is FrequencyUnit {
  return (FREQUENCY_UNITS as readonly string[]).includes(value);
}
