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
import {
  locationOptionLabel,
  parseClientChoices,
  parseClientSites,
  parseFinderAssets,
  parseFinderLocations,
  parseLeadUsers,
} from "@/lib/audits";
import { parseMaintenanceTypeList, type MaintenanceType } from "@/lib/maintenance-types";
import { parseMaintenanceScheduleList } from "@/lib/maintenance-schedules";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  parseWorkOrderBody,
  workOrderAssetLabel,
  workOrderAssigneeLabel,
  workOrderPriorityLabel,
  workOrderStatusLabel,
  workOrderTypeLabel,
  type WorkOrder,
  type WorkOrderList,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/lib/work-orders";

export function WorkOrderPanel({
  assetId,
  assetLabel,
  orders,
  loading,
  error,
  canCreate,
  canEdit,
  onReload,
  requestedOrderId = null,
  requestedOrder = null,
  onRequestedOrderClose,
}: {
  assetId?: string;
  assetLabel?: string;
  orders: WorkOrderList | null;
  loading: boolean;
  error: string | null;
  canCreate: boolean;
  canEdit: boolean;
  onReload: () => Promise<void>;
  requestedOrderId?: string | null;
  requestedOrder?: WorkOrder | null;
  onRequestedOrderClose?: () => void;
}) {
  const scope = assetId ?? "all";
  const [open, setOpen] = useState<WorkOrder | "create" | null>(null);
  const [openFor, setOpenFor] = useState(scope);
  const [trackedRequest, setTrackedRequest] = useState<string | null>(null);
  const [appliedOrderId, setAppliedOrderId] = useState<string | null>(null);

  if (openFor !== scope) {
    setOpenFor(scope);
    setOpen(null);
    setTrackedRequest(null);
    setAppliedOrderId(null);
  }

  if (requestedOrderId !== trackedRequest) {
    setTrackedRequest(requestedOrderId);
    setAppliedOrderId(null);
    setOpen(null);
  }

  if (
    requestedOrder &&
    requestedOrderId === requestedOrder.id &&
    appliedOrderId !== requestedOrder.id
  ) {
    setAppliedOrderId(requestedOrder.id);
    setOpen(requestedOrder);
  }

  function closeModal() {
    setOpen(null);
    onRequestedOrderClose?.();
  }

  const columns = assetId
    ? ["Title", "Type", "Priority", "Status", "Due date"]
    : ["Title", "Client", "Asset", "Type", "Priority", "Status", "Due date"];

  return (
    <section>
      {error ? (
        <p className="mb-4 text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {!orders && loading ? <p className="text-sm text-muted">Loading work orders…</p> : null}
      {canCreate && !open ? (
        <div className="flex justify-end">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setOpen("create");
            }}
          >
            New work order
          </button>
        </div>
      ) : null}
      {orders && orders.workOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No work orders yet.</p>
      ) : null}
      {orders && orders.workOrders.length > 0 ? (
        <DataTable columns={columns}>
          {orders.workOrders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-5 py-4">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-gray-800"
                  onClick={() => {
                    setOpen(order);
                  }}
                >
                  {order.title}
                </button>
              </td>
              {assetId ? null : (
                <>
                  <td className="px-5 py-4 text-sm text-gray-500">{order.client.name}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {workOrderAssetLabel(order.asset)}
                  </td>
                </>
              )}
              <td className="px-5 py-4 text-sm text-gray-500">
                {workOrderTypeLabel(order.maintenanceType)}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">
                {workOrderPriorityLabel(order.priority)}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">
                {workOrderStatusLabel(order.status)}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{order.dueDate ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}
      {open ? (
        <Modal
          title={open === "create" ? "New work order" : open.title}
          onClose={closeModal}
        >
          <WorkOrderForm
            key={open === "create" ? "create" : open.id}
            order={open === "create" ? null : open}
            fixedAssetId={assetId}
            fixedAssetLabel={assetLabel}
            canEdit={canEdit}
            onCancel={closeModal}
            onSaved={async () => {
              closeModal();
              await onReload();
            }}
            onMissing={async () => {
              closeModal();
              await onReload();
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}

function WorkOrderForm({
  order,
  fixedAssetId,
  fixedAssetLabel,
  canEdit,
  onCancel,
  onSaved,
  onMissing,
}: {
  order: WorkOrder | null;
  fixedAssetId?: string;
  fixedAssetLabel?: string;
  canEdit: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onMissing: () => Promise<void>;
}) {
  const creating = !order;
  const showAssetPicker = creating && !fixedAssetId;
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [assetId, setAssetId] = useState(fixedAssetId ?? order?.assetId ?? "");
  const [title, setTitle] = useState(order?.title ?? "");
  const [maintenanceTypeId, setMaintenanceTypeId] = useState(order?.maintenanceTypeId ?? "");
  const [scheduleId, setScheduleId] = useState(order?.scheduleId ?? "");
  const [assignedTo, setAssignedTo] = useState(order?.assignedTo ?? "");
  const [description, setDescription] = useState(order?.description ?? "");
  const [priority, setPriority] = useState<WorkOrderPriority>(order?.priority ?? "medium");
  const [status, setStatus] = useState<WorkOrderStatus>(order?.status ?? "open");
  const [dueDate, setDueDate] = useState(order?.dueDate ?? "");
  const [scheduledDate, setScheduledDate] = useState(order?.scheduledDate ?? "");
  const [completedAt, setCompletedAt] = useState(toDateTimeLocal(order?.completedAt ?? null));
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const clientsRequest = useApi(showAssetPicker ? "/api/clients" : null, parseClientChoices);
  const clientRequest = useApi(
    showAssetPicker && clientId ? `/api/clients/${clientId}` : null,
    parseClientSites,
  );
  const locationsRequest = useApi(
    showAssetPicker && siteId ? `/api/sites/${siteId}/locations` : null,
    parseFinderLocations,
  );
  const assetsRequest = useApi(
    showAssetPicker && locationId ? `/api/locations/${locationId}/assets` : null,
    parseFinderAssets,
  );
  const typesRequest = useApi(canEdit ? "/api/maintenance-types" : null, parseMaintenanceTypeList);
  const schedulesRequest = useApi(
    canEdit && assetId ? `/api/assets/${assetId}/maintenance-schedules` : null,
    parseMaintenanceScheduleList,
  );
  const usersRequest = useApi(canEdit ? "/api/clients/users" : null, parseLeadUsers);
  const fieldErrors = error?.fieldErrors ?? {};
  const disabled = pending || !canEdit;
  const hideAssigneePicker = usersRequest.error?.status === 403;
  const typeOptions = maintenanceTypeOptions(typesRequest.data ?? [], order);
  const scheduleOptions = scheduleChoices(
    schedulesRequest.data?.maintenanceSchedules ?? [],
    order,
    assetId,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const draft = {
      clientId,
      siteId,
      locationId,
      assetId,
      title,
      maintenanceTypeId,
      scheduleId,
      assignedTo: hideAssigneePicker ? (order?.assignedTo ?? "") : assignedTo,
      description,
      priority,
      status,
      dueDate,
      scheduledDate,
      completedAt,
    };
    const localErrors = validateWorkOrder(draft, showAssetPicker);

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = order
      ? updatePayload(order, draft, !hideAssigneePicker)
      : createPayload(draft, !hideAssigneePicker);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      parseWorkOrderBody(
        await apiRequest(
          creating ? `/api/assets/${assetId}/work-orders` : `/api/work-orders/${order.id}`,
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
        await onMissing();
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
        id="work-order-title"
        name="title"
        label="Title"
        required={canEdit}
        maxLength={255}
        value={title}
        disabled={disabled}
        messages={fieldErrors.title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      {showAssetPicker ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceField
            id="work-order-client"
            label="Client"
            value={clientId}
            disabled={disabled || clientsRequest.loading}
            placeholder="Choose a client"
            messages={fieldErrors.clientId}
            error={clientsRequest.error?.message ?? null}
            options={(clientsRequest.data ?? []).map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            onChange={(next) => {
              setClientId(next);
              setSiteId("");
              setLocationId("");
              setAssetId("");
              setScheduleId("");
            }}
          />
          <ChoiceField
            id="work-order-site"
            label="Site"
            value={siteId}
            disabled={disabled || !clientId || clientRequest.loading}
            placeholder="Choose a site"
            messages={fieldErrors.siteId}
            error={clientRequest.error?.message ?? null}
            options={(clientRequest.data?.sites ?? []).map((site) => ({
              value: site.id,
              label: site.name,
            }))}
            onChange={(next) => {
              setSiteId(next);
              setLocationId("");
              setAssetId("");
              setScheduleId("");
            }}
          />
          <ChoiceField
            id="work-order-location"
            label="Location"
            value={locationId}
            disabled={disabled || !siteId || locationsRequest.loading}
            placeholder="Choose a location"
            messages={fieldErrors.locationId}
            error={locationsRequest.error?.message ?? null}
            options={(locationsRequest.data ?? []).map((location) => ({
              value: location.id,
              label: locationOptionLabel(location),
            }))}
            onChange={(next) => {
              setLocationId(next);
              setAssetId("");
              setScheduleId("");
            }}
          />
          <ChoiceField
            id="work-order-asset"
            label="Asset"
            value={assetId}
            disabled={disabled || !locationId || assetsRequest.loading}
            placeholder="Choose an asset"
            messages={fieldErrors.assetId}
            error={assetsRequest.error?.message ?? null}
            options={(assetsRequest.data ?? []).map((asset) => ({
              value: asset.id,
              label: asset.assetName ?? asset.assetRef,
            }))}
            onChange={(next) => {
              setAssetId(next);
              setScheduleId("");
            }}
          />
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-gray-700">Asset</p>
          <p className="mt-1.5 text-sm text-gray-800">
            {order ? workOrderAssetLabel(order.asset) : (fixedAssetLabel ?? "Asset")}
          </p>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {canEdit ? (
          <div>
            <label
              id="work-order-type-label"
              className="block text-sm font-medium text-gray-700"
              htmlFor="work-order-type"
            >
              Maintenance type
            </label>
            <AssetTypePicker
              id="work-order-type"
              types={typeOptions}
              value={maintenanceTypeId}
              disabled={disabled}
              loading={typesRequest.loading}
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
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">Maintenance type</p>
            <p className="mt-1.5 text-sm text-gray-800">
              {order ? workOrderTypeLabel(order.maintenanceType) : "—"}
            </p>
          </div>
        )}
        {canEdit ? (
          <div>
            <label
              id="work-order-schedule-label"
              className="block text-sm font-medium text-gray-700"
              htmlFor="work-order-schedule"
            >
              Schedule
            </label>
            <AssetTypePicker
              id="work-order-schedule"
              types={scheduleOptions.map((schedule) => ({
                id: schedule.id,
                name: schedule.name,
                code: "",
              }))}
              value={scheduleId}
              disabled={disabled || !assetId}
              loading={Boolean(assetId) && schedulesRequest.loading}
              showCode={false}
              listLabel="Schedules"
              searchPlaceholder="Search schedules"
              loadingLabel="Loading schedules…"
              clearLabel="None"
              onChange={setScheduleId}
            />
            {schedulesRequest.error ? (
              <p className="mt-1.5 text-sm text-error-500" role="alert">
                {schedulesRequest.error.message}
              </p>
            ) : null}
            <FieldMessages messages={fieldErrors.scheduleId} />
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">Schedule</p>
            <p className="mt-1.5 text-sm text-gray-800">{order?.schedule?.name ?? "—"}</p>
          </div>
        )}
      </div>
      {canEdit && !hideAssigneePicker ? (
        <div>
          <label
            id="work-order-assignee-label"
            className="block text-sm font-medium text-gray-700"
            htmlFor="work-order-assignee"
          >
            Assignee
          </label>
          <AssetTypePicker
            id="work-order-assignee"
            types={assigneeOptions(usersRequest.data ?? [], order)}
            value={assignedTo}
            disabled={disabled}
            loading={usersRequest.loading}
            showCode={false}
            listLabel="Assignees"
            searchPlaceholder="Search assignees"
            loadingLabel="Loading assignees…"
            clearLabel="None"
            onChange={setAssignedTo}
          />
          {usersRequest.error && usersRequest.error.status !== 403 ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {usersRequest.error.message}
            </p>
          ) : null}
          <FieldMessages messages={fieldErrors.assignedTo} />
        </div>
      ) : !creating || !canEdit ? (
        <div>
          <p className="text-sm font-medium text-gray-700">Assignee</p>
          <p className="mt-1.5 text-sm text-gray-800">
            {workOrderAssigneeLabel(order?.assignee ?? null)}
          </p>
        </div>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="work-order-description">
          Description
        </label>
        <textarea
          id="work-order-description"
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
      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceField
          id="work-order-priority"
          label="Priority"
          value={priority}
          disabled={disabled}
          messages={fieldErrors.priority}
          options={WORK_ORDER_PRIORITIES.map((value) => ({
            value,
            label: workOrderPriorityLabel(value),
          }))}
          onChange={(next) => {
            if (isPriority(next)) {
              setPriority(next);
            }
          }}
        />
        <ChoiceField
          id="work-order-status"
          label="Status"
          value={status}
          disabled={disabled}
          messages={fieldErrors.status}
          options={WORK_ORDER_STATUSES.map((value) => ({
            value,
            label: workOrderStatusLabel(value),
          }))}
          onChange={(next) => {
            if (isStatus(next)) {
              setStatus(next);
            }
          }}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="work-order-due"
          name="dueDate"
          label="Due date"
          type="date"
          value={dueDate}
          disabled={disabled}
          messages={fieldErrors.dueDate}
          onChange={(event) => {
            setDueDate(event.target.value);
          }}
        />
        <TextField
          id="work-order-scheduled"
          name="scheduledDate"
          label="Scheduled date"
          type="date"
          value={scheduledDate}
          disabled={disabled}
          messages={fieldErrors.scheduledDate}
          onChange={(event) => {
            setScheduledDate(event.target.value);
          }}
        />
      </div>
      <TextField
        id="work-order-completed"
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
  );

  if (!canEdit) {
    return fields;
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      {fields}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "New work order" : "Save"}
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

function ChoiceField({
  id,
  label,
  value,
  disabled,
  placeholder,
  options,
  messages,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
  messages?: string[];
  error?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={inputClassName}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1.5 text-sm text-error-500" role="alert">
          {error}
        </p>
      ) : null}
      <FieldMessages messages={messages} />
    </div>
  );
}

type WorkOrderDraft = {
  clientId: string;
  siteId: string;
  locationId: string;
  assetId: string;
  title: string;
  maintenanceTypeId: string;
  scheduleId: string;
  assignedTo: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  dueDate: string;
  scheduledDate: string;
  completedAt: string;
};

function validateWorkOrder(draft: WorkOrderDraft, showAssetPicker: boolean): FieldErrors | null {
  const errors: FieldErrors = {};
  const title = draft.title.trim();

  if (!title) {
    errors.title = ["Enter a title."];
  } else if (title.length > 255) {
    errors.title = ["Enter a title up to 255 characters."];
  }

  if (showAssetPicker) {
    if (!draft.clientId) {
      errors.clientId = ["Choose a client."];
    }

    if (!draft.siteId) {
      errors.siteId = ["Choose a site."];
    }

    if (!draft.locationId) {
      errors.locationId = ["Choose a location."];
    }

    if (!draft.assetId) {
      errors.assetId = ["Choose an asset."];
    }
  }

  if (!draft.maintenanceTypeId) {
    errors.maintenanceTypeId = ["Choose a maintenance type."];
  }

  if (!validDate(draft.dueDate)) {
    errors.dueDate = ["Enter a date."];
  }

  if (!validDate(draft.scheduledDate)) {
    errors.scheduledDate = ["Enter a date."];
  }

  if (draft.completedAt.trim() && completedAtValue(draft.completedAt) == null) {
    errors.completedAt = ["Enter a date and time."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function createPayload(draft: WorkOrderDraft, includeAssignee: boolean) {
  const description = emptyToNull(draft.description);
  const dueDate = emptyToNull(draft.dueDate);
  const scheduledDate = emptyToNull(draft.scheduledDate);
  const completedAt = completedAtValue(draft.completedAt);

  return {
    title: draft.title.trim(),
    maintenanceTypeId: draft.maintenanceTypeId,
    priority: draft.priority,
    status: draft.status,
    ...(draft.scheduleId ? { scheduleId: draft.scheduleId } : {}),
    ...(includeAssignee && draft.assignedTo ? { assignedTo: draft.assignedTo } : {}),
    ...(description ? { description } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(scheduledDate ? { scheduledDate } : {}),
    ...(completedAt ? { completedAt } : {}),
  };
}

function updatePayload(order: WorkOrder, draft: WorkOrderDraft, includeAssignee: boolean) {
  const payload: Record<string, string | null> = {};
  const title = draft.title.trim();
  const description = emptyToNull(draft.description);
  const dueDate = emptyToNull(draft.dueDate);
  const scheduledDate = emptyToNull(draft.scheduledDate);
  const completedAt = completedAtValue(draft.completedAt);
  const scheduleId = draft.scheduleId || null;
  const assignedTo = draft.assignedTo || null;

  if (title !== order.title) {
    payload.title = title;
  }

  if (draft.maintenanceTypeId !== order.maintenanceTypeId) {
    payload.maintenanceTypeId = draft.maintenanceTypeId;
  }

  if (scheduleId !== order.scheduleId) {
    payload.scheduleId = scheduleId;
  }

  if (includeAssignee && assignedTo !== order.assignedTo) {
    payload.assignedTo = assignedTo;
  }

  if (description !== order.description) {
    payload.description = description;
  }

  if (draft.priority !== order.priority) {
    payload.priority = draft.priority;
  }

  if (draft.status !== order.status) {
    payload.status = draft.status;
  }

  if (dueDate !== order.dueDate) {
    payload.dueDate = dueDate;
  }

  if (scheduledDate !== order.scheduledDate) {
    payload.scheduledDate = scheduledDate;
  }

  if (!sameInstant(completedAt, order.completedAt)) {
    payload.completedAt = completedAt;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function maintenanceTypeOptions(
  types: MaintenanceType[],
  order: WorkOrder | null,
): WorkOrderType[] {
  const active = types.filter((type) => type.isActive);

  if (order && !active.some((type) => type.id === order.maintenanceTypeId)) {
    return [...active, order.maintenanceType];
  }

  return active;
}

function assigneeOptions(
  users: { id: string; email: string; name: string | null }[],
  order: WorkOrder | null,
) {
  const options = users.map((user) => ({
    id: user.id,
    name: user.name ?? user.email,
    code: "",
  }));

  if (order?.assignee && !options.some((option) => option.id === order.assignee?.id)) {
    options.unshift({
      id: order.assignee.id,
      name: order.assignee.name ?? order.assignee.email,
      code: "",
    });
  }

  return options;
}

function scheduleChoices(
  schedules: { id: string; name: string }[],
  order: WorkOrder | null,
  assetId: string,
) {
  const options = schedules.map((schedule) => ({ id: schedule.id, name: schedule.name }));

  if (
    order?.schedule &&
    order.assetId === assetId &&
    !options.some((schedule) => schedule.id === order.schedule?.id)
  ) {
    options.push(order.schedule);
  }

  return options;
}

function validDate(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function completedAtValue(value: string): string | null {
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

function isPriority(value: string): value is WorkOrderPriority {
  return (WORK_ORDER_PRIORITIES as readonly string[]).includes(value);
}

function isStatus(value: string): value is WorkOrderStatus {
  return (WORK_ORDER_STATUSES as readonly string[]).includes(value);
}
