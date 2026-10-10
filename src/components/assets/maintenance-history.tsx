"use client";

import { useState } from "react";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { Modal } from "@/components/modal";
import {
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
import { parseLeadUsers } from "@/lib/audits";
import {
  parseMaintenanceHistoryBody,
  type HistoryMaintenanceType,
  type HistoryPerformer,
  type HistoryWorkOrder,
  type MaintenanceHistory,
  type MaintenanceHistoryList,
} from "@/lib/maintenance-history";
import { parseMaintenanceTypeList, type MaintenanceType } from "@/lib/maintenance-types";
import { type WorkOrderList } from "@/lib/work-orders";

export function MaintenanceHistoryPanel({
  assetId,
  records,
  loading,
  error,
  workOrders,
  canEdit,
  canPickTypes,
  requestedHistoryId = null,
  onRequestedHistoryClose,
  onReload,
  onAssetMissing,
}: {
  assetId: string;
  records: MaintenanceHistoryList | null;
  loading: boolean;
  error: string | null;
  workOrders: WorkOrderList | null;
  canEdit: boolean;
  canPickTypes: boolean;
  requestedHistoryId?: string | null;
  onRequestedHistoryClose?: () => void;
  onReload: () => Promise<void>;
  onAssetMissing: () => void;
}) {
  const [open, setOpen] = useState<MaintenanceHistory | "create" | null>(null);
  const [openFor, setOpenFor] = useState(assetId);
  const [trackedRequest, setTrackedRequest] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const showAdd = canEdit && canPickTypes;
  const requested =
    records?.maintenanceHistories.find((record) => record.id === requestedHistoryId) ?? null;

  if (openFor !== assetId) {
    setOpenFor(assetId);
    setOpen(null);
    setTrackedRequest(null);
    setAppliedId(null);
  }

  if (requestedHistoryId !== trackedRequest) {
    setTrackedRequest(requestedHistoryId);
    setAppliedId(null);
    setOpen(null);
  }

  if (requested && requestedHistoryId === requested.id && appliedId !== requested.id) {
    setAppliedId(requested.id);
    setOpen(requested);
  }

  function closeModal() {
    setOpen(null);
    onRequestedHistoryClose?.();
  }

  if (!records) {
    if (loading) {
      return <p className="text-sm text-muted">Loading maintenance history…</p>;
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
            Add maintenance history
          </button>
        </div>
      ) : null}
      {records.maintenanceHistories.length === 0 ? (
        <p className="text-sm text-gray-500">No maintenance history yet.</p>
      ) : (
        <DataTable columns={["Reference", "Performed", "Type", "Description"]}>
          {records.maintenanceHistories.map((record) => (
            <tr
              key={record.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => {
                setOpen(record);
              }}
            >
              <td className="px-5 py-4">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-gray-800"
                  onClick={() => {
                    setOpen(record);
                  }}
                >
                  {record.referenceNumber}
                </button>
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{formatPerformed(record.performedAt)}</td>
              <td className="px-5 py-4 text-sm text-gray-500">{record.maintenanceType.name}</td>
              <td className="max-w-xs px-5 py-4 text-sm text-gray-500">
                <span className="block truncate" title={record.workDescription}>
                  {record.workDescription}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {open ? (
        <Modal
          title={open === "create" ? "Add maintenance history" : open.referenceNumber}
          onClose={closeModal}
        >
          <HistoryForm
            key={open === "create" ? "create" : open.id}
            assetId={assetId}
            record={open === "create" ? null : open}
            workOrders={workOrders}
            canEdit={canEdit}
            canPickTypes={canPickTypes}
            onCancel={closeModal}
            onSaved={async () => {
              closeModal();
              await onReload();
            }}
            onMissing={async () => {
              closeModal();
              await onReload();
            }}
            onAssetMissing={onAssetMissing}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function HistoryForm({
  assetId,
  record,
  workOrders,
  canEdit,
  canPickTypes,
  onCancel,
  onSaved,
  onMissing,
  onAssetMissing,
}: {
  assetId: string;
  record: MaintenanceHistory | null;
  workOrders: WorkOrderList | null;
  canEdit: boolean;
  canPickTypes: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onMissing: () => Promise<void>;
  onAssetMissing: () => void;
}) {
  const creating = !record;
  const typesRequest = useApi(
    canPickTypes ? "/api/maintenance-types" : null,
    parseMaintenanceTypeList,
  );
  const usersRequest = useApi(canEdit ? "/api/clients/users" : null, parseLeadUsers);
  const [maintenanceTypeId, setMaintenanceTypeId] = useState(record?.maintenanceTypeId ?? "");
  const [workDescription, setWorkDescription] = useState(record?.workDescription ?? "");
  const [workOrderId, setWorkOrderId] = useState(record?.workOrderId ?? "");
  const [performedAt, setPerformedAt] = useState(toDateTimeLocal(record?.performedAt ?? null));
  const [completedAt, setCompletedAt] = useState(toDateTimeLocal(record?.completedAt ?? null));
  const [performedBy, setPerformedBy] = useState(record?.performedBy ?? "");
  const [findings, setFindings] = useState(record?.findings ?? "");
  const [actionsTaken, setActionsTaken] = useState(record?.actionsTaken ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [conditionBefore, setConditionBefore] = useState(record?.conditionBefore ?? "");
  const [conditionAfter, setConditionAfter] = useState(record?.conditionAfter ?? "");
  const [outcome, setOutcome] = useState(record?.outcome ?? "");
  const [labourCost, setLabourCost] = useState(costValue(record?.labourCost ?? null));
  const [materialsCost, setMaterialsCost] = useState(costValue(record?.materialsCost ?? null));
  const [otherCost, setOtherCost] = useState(costValue(record?.otherCost ?? null));
  const [nextRecommendedDate, setNextRecommendedDate] = useState(record?.nextRecommendedDate ?? "");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const disabled = pending || !canEdit;
  const hidePerformerPicker = usersRequest.error?.status === 403;
  const typeOptions = maintenanceTypeOptions(typesRequest.data ?? [], record);
  const orderOptions = workOrderOptions(workOrders, record);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const draft: HistoryDraft = {
      maintenanceTypeId,
      workDescription,
      workOrderId,
      performedAt,
      completedAt,
      performedBy: hidePerformerPicker ? (record?.performedBy ?? "") : performedBy,
      findings,
      actionsTaken,
      notes,
      conditionBefore,
      conditionAfter,
      outcome,
      labourCost,
      materialsCost,
      otherCost,
      nextRecommendedDate,
    };
    const localErrors = validateHistory(draft, creating || canPickTypes);

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = record
      ? updatePayload(record, draft, canPickTypes, !hidePerformerPicker)
      : createPayload(draft, !hidePerformerPicker);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseMaintenanceHistoryBody(
        await apiRequest(
          creating
            ? `/api/assets/${assetId}/maintenance-history`
            : `/api/maintenance-history/${record.id}`,
          {
            method: creating ? "POST" : "PATCH",
            body: JSON.stringify(payload),
          },
        ),
      );
      await onSaved();
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404 && apiError.message !== "Performer not found.") {
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
      {record ? (
        <TextField
          id="history-reference"
          label="Reference"
          value={record.referenceNumber}
          disabled
          readOnly
        />
      ) : null}
      {canPickTypes ? (
        <div>
          <label
            id="history-type-label"
            className="block text-sm font-medium text-gray-700"
            htmlFor="history-type"
          >
            Maintenance type
          </label>
          <AssetTypePicker
            id="history-type"
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
      ) : record ? (
        <div>
          <p className="text-sm font-medium text-gray-700">Maintenance type</p>
          <p className="mt-1.5 text-sm text-gray-800">{record.maintenanceType.name}</p>
        </div>
      ) : null}
      <TextArea
        id="history-description"
        label="Work description"
        required={canEdit}
        maxLength={5000}
        value={workDescription}
        disabled={disabled}
        messages={fieldErrors.workDescription}
        onChange={setWorkDescription}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="history-work-order">
          Work order
        </label>
        <select
          id="history-work-order"
          name="workOrderId"
          value={workOrderId}
          disabled={disabled || !workOrders}
          onChange={(event) => {
            setWorkOrderId(event.target.value);
          }}
          className={inputClassName}
        >
          <option value="">None</option>
          {orderOptions.map((order) => (
            <option key={order.id} value={order.id}>
              {order.reference} · {order.title}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.workOrderId} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="history-performed-at"
          name="performedAt"
          label="Performed at"
          type="datetime-local"
          required={canEdit}
          value={performedAt}
          disabled={disabled}
          messages={fieldErrors.performedAt}
          onChange={(event) => {
            setPerformedAt(event.target.value);
          }}
        />
        <TextField
          id="history-completed-at"
          name="completedAt"
          label="Completed at"
          type="datetime-local"
          value={completedAt}
          disabled={disabled}
          messages={fieldErrors.completedAt}
          onChange={(event) => {
            setCompletedAt(event.target.value);
          }}
        />
      </div>
      {canEdit && !hidePerformerPicker ? (
        <div>
          <label
            id="history-performer-label"
            className="block text-sm font-medium text-gray-700"
            htmlFor="history-performer"
          >
            Performed by
          </label>
          <AssetTypePicker
            id="history-performer"
            types={performerOptions(usersRequest.data ?? [], record)}
            value={performedBy}
            disabled={disabled}
            loading={usersRequest.loading}
            showCode={false}
            listLabel="People"
            searchPlaceholder="Search people"
            loadingLabel="Loading people…"
            clearLabel="None"
            onChange={setPerformedBy}
          />
          {usersRequest.error && usersRequest.error.status !== 403 ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {usersRequest.error.message}
            </p>
          ) : null}
          <FieldMessages messages={fieldErrors.performedBy} />
        </div>
      ) : record ? (
        <div>
          <p className="text-sm font-medium text-gray-700">Performed by</p>
          <p className="mt-1.5 text-sm text-gray-800">{performerLabel(record.performer)}</p>
        </div>
      ) : null}
      <TextArea
        id="history-findings"
        label="Findings"
        maxLength={5000}
        value={findings}
        disabled={disabled}
        messages={fieldErrors.findings}
        onChange={setFindings}
      />
      <TextArea
        id="history-actions"
        label="Actions taken"
        maxLength={5000}
        value={actionsTaken}
        disabled={disabled}
        messages={fieldErrors.actionsTaken}
        onChange={setActionsTaken}
      />
      <TextArea
        id="history-notes"
        label="Notes"
        maxLength={5000}
        value={notes}
        disabled={disabled}
        messages={fieldErrors.notes}
        onChange={setNotes}
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          id="history-condition-before"
          name="conditionBefore"
          label="Condition before"
          maxLength={30}
          value={conditionBefore}
          disabled={disabled}
          messages={fieldErrors.conditionBefore}
          onChange={(event) => {
            setConditionBefore(event.target.value);
          }}
        />
        <TextField
          id="history-condition-after"
          name="conditionAfter"
          label="Condition after"
          maxLength={30}
          value={conditionAfter}
          disabled={disabled}
          messages={fieldErrors.conditionAfter}
          onChange={(event) => {
            setConditionAfter(event.target.value);
          }}
        />
        <TextField
          id="history-outcome"
          name="outcome"
          label="Outcome"
          maxLength={30}
          value={outcome}
          disabled={disabled}
          messages={fieldErrors.outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          id="history-labour-cost"
          name="labourCost"
          label="Labour cost"
          inputMode="decimal"
          value={labourCost}
          disabled={disabled}
          messages={fieldErrors.labourCost}
          onChange={(event) => {
            setLabourCost(event.target.value);
          }}
        />
        <TextField
          id="history-materials-cost"
          name="materialsCost"
          label="Materials cost"
          inputMode="decimal"
          value={materialsCost}
          disabled={disabled}
          messages={fieldErrors.materialsCost}
          onChange={(event) => {
            setMaterialsCost(event.target.value);
          }}
        />
        <TextField
          id="history-other-cost"
          name="otherCost"
          label="Other cost"
          inputMode="decimal"
          value={otherCost}
          disabled={disabled}
          messages={fieldErrors.otherCost}
          onChange={(event) => {
            setOtherCost(event.target.value);
          }}
        />
      </div>
      <TextField
        id="history-next-date"
        name="nextRecommendedDate"
        label="Next recommended date"
        type="date"
        value={nextRecommendedDate}
        disabled={disabled}
        messages={fieldErrors.nextRecommendedDate}
        onChange={(event) => {
          setNextRecommendedDate(event.target.value);
        }}
      />
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
          {pending ? "Saving…" : creating ? "Add maintenance history" : "Save"}
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

function TextArea({
  id,
  label,
  required,
  maxLength,
  value,
  disabled,
  messages,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  maxLength: number;
  value: string;
  disabled: boolean;
  messages?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        required={required}
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={`${inputClassName} min-h-28 py-3`}
      />
      <FieldMessages messages={messages} />
    </div>
  );
}

type HistoryDraft = {
  maintenanceTypeId: string;
  workDescription: string;
  workOrderId: string;
  performedAt: string;
  completedAt: string;
  performedBy: string;
  findings: string;
  actionsTaken: string;
  notes: string;
  conditionBefore: string;
  conditionAfter: string;
  outcome: string;
  labourCost: string;
  materialsCost: string;
  otherCost: string;
  nextRecommendedDate: string;
};

type HistoryPayload = {
  maintenanceTypeId?: string;
  workDescription?: string;
  workOrderId?: string | null;
  performedAt?: string;
  completedAt?: string | null;
  performedBy?: string | null;
  findings?: string | null;
  actionsTaken?: string | null;
  notes?: string | null;
  conditionBefore?: string | null;
  conditionAfter?: string | null;
  outcome?: string | null;
  labourCost?: number | null;
  materialsCost?: number | null;
  otherCost?: number | null;
  nextRecommendedDate?: string | null;
};

function validateHistory(draft: HistoryDraft, requireType: boolean): FieldErrors | null {
  const errors: FieldErrors = {};
  const description = draft.workDescription.trim();

  if (requireType && !draft.maintenanceTypeId) {
    errors.maintenanceTypeId = ["Choose a maintenance type."];
  }

  if (!description) {
    errors.workDescription = ["Enter a work description."];
  } else if (description.length > 5000) {
    errors.workDescription = ["Enter a work description up to 5000 characters."];
  }

  if (!draft.performedAt.trim() || timestampValue(draft.performedAt) == null) {
    errors.performedAt = ["Enter a date and time."];
  }

  if (draft.completedAt.trim() && timestampValue(draft.completedAt) == null) {
    errors.completedAt = ["Enter a date and time."];
  }

  noteError(errors, "findings", draft.findings);
  noteError(errors, "actionsTaken", draft.actionsTaken);
  noteError(errors, "notes", draft.notes);
  shortError(errors, "conditionBefore", draft.conditionBefore);
  shortError(errors, "conditionAfter", draft.conditionAfter);
  shortError(errors, "outcome", draft.outcome);

  if (draft.labourCost.trim() && validCost(draft.labourCost) == null) {
    errors.labourCost = ["Enter a cost with at most 2 decimal places."];
  }

  if (draft.materialsCost.trim() && validCost(draft.materialsCost) == null) {
    errors.materialsCost = ["Enter a cost with at most 2 decimal places."];
  }

  if (draft.otherCost.trim() && validCost(draft.otherCost) == null) {
    errors.otherCost = ["Enter a cost with at most 2 decimal places."];
  }

  if (!validDate(draft.nextRecommendedDate)) {
    errors.nextRecommendedDate = ["Enter a date."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function createPayload(draft: HistoryDraft, includePerformer: boolean): HistoryPayload {
  const performedAt = timestampValue(draft.performedAt);

  return {
    maintenanceTypeId: draft.maintenanceTypeId,
    workDescription: draft.workDescription.trim(),
    workOrderId: draft.workOrderId || null,
    performedAt: performedAt ?? "",
    completedAt: timestampValue(draft.completedAt),
    ...(includePerformer ? { performedBy: draft.performedBy || null } : {}),
    findings: emptyToNull(draft.findings),
    actionsTaken: emptyToNull(draft.actionsTaken),
    notes: emptyToNull(draft.notes),
    conditionBefore: emptyToNull(draft.conditionBefore),
    conditionAfter: emptyToNull(draft.conditionAfter),
    outcome: emptyToNull(draft.outcome),
    labourCost: draft.labourCost.trim() ? validCost(draft.labourCost) : null,
    materialsCost: draft.materialsCost.trim() ? validCost(draft.materialsCost) : null,
    otherCost: draft.otherCost.trim() ? validCost(draft.otherCost) : null,
    nextRecommendedDate: emptyToNull(draft.nextRecommendedDate),
  };
}

function updatePayload(
  record: MaintenanceHistory,
  draft: HistoryDraft,
  includeType: boolean,
  includePerformer: boolean,
): HistoryPayload | null {
  const payload: HistoryPayload = {};
  const description = draft.workDescription.trim();
  const performedAt = timestampValue(draft.performedAt);
  const completedAt = timestampValue(draft.completedAt);
  const workOrderId = draft.workOrderId || null;
  const performedBy = draft.performedBy || null;
  const findings = emptyToNull(draft.findings);
  const actionsTaken = emptyToNull(draft.actionsTaken);
  const notes = emptyToNull(draft.notes);
  const conditionBefore = emptyToNull(draft.conditionBefore);
  const conditionAfter = emptyToNull(draft.conditionAfter);
  const outcome = emptyToNull(draft.outcome);
  const labour = draft.labourCost.trim() ? validCost(draft.labourCost) : null;
  const materials = draft.materialsCost.trim() ? validCost(draft.materialsCost) : null;
  const other = draft.otherCost.trim() ? validCost(draft.otherCost) : null;
  const nextRecommendedDate = emptyToNull(draft.nextRecommendedDate);

  if (includeType && draft.maintenanceTypeId !== record.maintenanceTypeId) {
    payload.maintenanceTypeId = draft.maintenanceTypeId;
  }

  if (description !== record.workDescription) {
    payload.workDescription = description;
  }

  if (workOrderId !== record.workOrderId) {
    payload.workOrderId = workOrderId;
  }

  if (performedAt && !sameInstant(performedAt, record.performedAt)) {
    payload.performedAt = performedAt;
  }

  if (!sameInstant(completedAt, record.completedAt)) {
    payload.completedAt = completedAt;
  }

  if (includePerformer && performedBy !== record.performedBy) {
    payload.performedBy = performedBy;
  }

  if (findings !== record.findings) {
    payload.findings = findings;
  }

  if (actionsTaken !== record.actionsTaken) {
    payload.actionsTaken = actionsTaken;
  }

  if (notes !== record.notes) {
    payload.notes = notes;
  }

  if (conditionBefore !== record.conditionBefore) {
    payload.conditionBefore = conditionBefore;
  }

  if (conditionAfter !== record.conditionAfter) {
    payload.conditionAfter = conditionAfter;
  }

  if (outcome !== record.outcome) {
    payload.outcome = outcome;
  }

  if (labour !== record.labourCost) {
    payload.labourCost = labour;
  }

  if (materials !== record.materialsCost) {
    payload.materialsCost = materials;
  }

  if (other !== record.otherCost) {
    payload.otherCost = other;
  }

  if (nextRecommendedDate !== record.nextRecommendedDate) {
    payload.nextRecommendedDate = nextRecommendedDate;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function maintenanceTypeOptions(
  types: MaintenanceType[],
  record: MaintenanceHistory | null,
): HistoryMaintenanceType[] {
  const active = types.filter((type) => type.isActive);

  if (record && !active.some((type) => type.id === record.maintenanceTypeId)) {
    return [...active, record.maintenanceType];
  }

  return active;
}

function workOrderOptions(
  workOrders: WorkOrderList | null,
  record: MaintenanceHistory | null,
): HistoryWorkOrder[] {
  const options = (workOrders?.workOrders ?? []).map((order) => ({
    id: order.id,
    reference: order.reference,
    title: order.title,
  }));

  if (record?.workOrder && !options.some((order) => order.id === record.workOrder?.id)) {
    options.unshift(record.workOrder);
  }

  return options;
}

function performerOptions(
  users: { id: string; email: string; name: string | null }[],
  record: MaintenanceHistory | null,
) {
  const options = users.map((user) => ({
    id: user.id,
    name: user.name ?? user.email,
    code: "",
  }));

  if (record?.performer && !options.some((option) => option.id === record.performer?.id)) {
    options.unshift({
      id: record.performer.id,
      name: record.performer.name ?? record.performer.email,
      code: "",
    });
  }

  return options;
}

function performerLabel(performer: HistoryPerformer | null): string {
  if (!performer) {
    return "—";
  }

  return performer.name ?? performer.email;
}

function noteError(errors: FieldErrors, key: string, value: string) {
  if (value.trim().length > 5000) {
    errors[key] = ["Enter up to 5000 characters."];
  }
}

function shortError(errors: FieldErrors, key: string, value: string) {
  if (value.trim().length > 30) {
    errors[key] = ["Enter up to 30 characters."];
  }
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

function timestampValue(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function sameInstant(left: string | null, right: string | null): boolean {
  if (left == null || right == null) {
    return left === right;
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left === right;
  }

  return leftTime === rightTime;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function costValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function formatPerformed(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
