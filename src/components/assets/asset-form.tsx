"use client";

import { useState } from "react";
import {
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { assetStatusLabel } from "@/components/assets/asset-table";
import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import { ParentAssetPicker } from "@/components/assets/parent-asset-picker";
import { LocationPicker } from "@/components/locations/location-picker";
import { Nrm3ClassificationPicker } from "@/components/nrm3-classifications/nrm3-classification-picker";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi, type FieldErrors } from "@/lib/api-client";
import { parseAssetTypeList } from "@/lib/asset-types";
import type { Location } from "@/lib/locations";
import { parseNrm3ClassificationList } from "@/lib/nrm3-classifications";
import {
  ASSET_TYPES_VIEW,
  NRM3_CLASSIFICATIONS_VIEW,
  hasPermission,
} from "@/lib/session";
import {
  ASSET_STATUSES,
  parseAssetBody,
  parseAssetList,
  type Asset,
  type AssetStatus,
} from "@/lib/sites";

export function AssetForm({
  locations,
  locationId,
  onCancel,
  onCreated,
}: {
  locations?: Location[];
  locationId?: string;
  onCancel: () => void;
  onCreated: (asset: Asset) => void;
}) {
  const { user } = useSession();
  const canPickTypes = hasPermission(user, ASSET_TYPES_VIEW);
  const canPickNrm3 = hasPermission(user, NRM3_CLASSIFICATIONS_VIEW);
  const typesRequest = useApi(canPickTypes ? "/api/asset-types" : null, parseAssetTypeList);
  const nrm3Request = useApi(
    canPickNrm3 ? "/api/nrm3-classifications" : null,
    parseNrm3ClassificationList,
  );
  const [selectedLocationId, setSelectedLocationId] = useState(locationId ?? "");
  const targetLocationId = locationId ?? selectedLocationId;
  const parentsRequest = useApi(
    targetLocationId ? `/api/locations/${targetLocationId}/assets` : null,
    parseAssetList,
  );
  const [tag, setTag] = useState("");
  const [assetName, setAssetName] = useState("");
  const [parentAssetId, setParentAssetId] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [yearOfManufacture, setYearOfManufacture] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [nrm3Code, setNrm3Code] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [status, setStatus] = useState<AssetStatus>("active");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};
  const assetTypes = (typesRequest.data ?? []).filter((assetType) => assetType.isActive);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors = validateAssetDraft({
      locationId: targetLocationId,
      tag,
      assetTypeId,
      quantity,
      yearOfManufacture,
    });

    if (localErrors) {
      setError(new ApiRequestError(400, "Invalid request", localErrors));
      return;
    }

    const payload = assetPayload({
      tag,
      assetName,
      parentAssetId,
      manufacturer,
      model,
      serialNumber,
      yearOfManufacture,
      assetTypeId,
      nrm3Code,
      quantity,
      unitOfMeasure,
      status,
    });

    setPending(true);
    setError(null);

    try {
      const asset = parseAssetBody(
        await apiRequest(`/api/locations/${targetLocationId}/assets`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      onCreated(asset);
    } catch (caught) {
      setError(asApiError(caught));
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      {locationId ? null : (
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="asset-location">
            Location
          </label>
          <div className="mt-1.5">
            <LocationPicker
              id="asset-location"
              locations={locations ?? []}
              value={selectedLocationId}
              disabled={pending}
              placeholder="Choose a location"
              onChange={(next) => {
                setSelectedLocationId(next);
                setParentAssetId("");
              }}
            />
          </div>
          <FieldMessages messages={fieldErrors.locationId} />
        </div>
      )}
      <TextField
        id="asset-tag"
        name="tag"
        label="Tag"
        required
        maxLength={100}
        value={tag}
        disabled={pending}
        messages={fieldErrors.tag}
        onChange={(event) => {
          setTag(event.target.value);
        }}
      />
      <TextField
        id="asset-name"
        name="assetName"
        label="Name"
        maxLength={255}
        value={assetName}
        disabled={pending}
        messages={fieldErrors.assetName}
        onChange={(event) => {
          setAssetName(event.target.value);
        }}
      />
      <div>
        <label
          id="asset-parent-label"
          className="block text-sm font-medium text-gray-700"
          htmlFor="asset-parent"
        >
          Parent asset
        </label>
        <ParentAssetPicker
          id="asset-parent"
          assets={parentsRequest.data?.assets ?? []}
          value={parentAssetId}
          disabled={pending || !targetLocationId}
          loading={Boolean(targetLocationId) && parentsRequest.loading}
          clearLabel="No parent asset"
          onChange={setParentAssetId}
        />
        <FieldMessages messages={fieldErrors.parentAssetId} />
        {parentsRequest.error ? (
          <p className="mt-1.5 text-sm text-error-500" role="alert">
            {parentsRequest.error.message}
          </p>
        ) : null}
      </div>
      <TextField
        id="asset-manufacturer"
        name="manufacturer"
        label="Manufacturer"
        value={manufacturer}
        disabled={pending}
        messages={fieldErrors.manufacturer}
        onChange={(event) => {
          setManufacturer(event.target.value);
        }}
      />
      <TextField
        id="asset-model"
        name="model"
        label="Model"
        maxLength={150}
        value={model}
        disabled={pending}
        messages={fieldErrors.model}
        onChange={(event) => {
          setModel(event.target.value);
        }}
      />
      <TextField
        id="asset-serial"
        name="serialNumber"
        label="Serial number"
        maxLength={150}
        value={serialNumber}
        disabled={pending}
        messages={fieldErrors.serialNumber}
        onChange={(event) => {
          setSerialNumber(event.target.value);
        }}
      />
      <TextField
        id="asset-year"
        name="yearOfManufacture"
        label="Year of manufacture"
        type="number"
        inputMode="numeric"
        step={1}
        min={1000}
        max={9999}
        value={yearOfManufacture}
        disabled={pending}
        messages={fieldErrors.yearOfManufacture}
        onChange={(event) => {
          setYearOfManufacture(event.target.value);
        }}
      />
      <div>
        <label
          id="asset-type-label"
          className="block text-sm font-medium text-gray-700"
          htmlFor="asset-type"
        >
          Type
        </label>
        {canPickTypes ? (
          <AssetTypePicker
            id="asset-type"
            types={assetTypes}
            value={assetTypeId}
            disabled={pending}
            loading={typesRequest.loading}
            onChange={setAssetTypeId}
          />
        ) : (
          <p className="mt-1.5 text-sm text-gray-500">
            Choosing an asset type needs access to asset types.
          </p>
        )}
        <FieldMessages messages={fieldErrors.assetTypeId} />
        {typesRequest.error ? (
          <p className="mt-1.5 text-sm text-error-500" role="alert">
            {typesRequest.error.message}
          </p>
        ) : null}
      </div>
      <div>
        <label
          id="asset-nrm3-label"
          className="block text-sm font-medium text-gray-700"
          htmlFor="asset-nrm3"
        >
          NRM3 classification
        </label>
        {canPickNrm3 ? (
          <Nrm3ClassificationPicker
            id="asset-nrm3"
            items={nrm3Request.data ?? []}
            value={nrm3Code}
            disabled={pending}
            loading={nrm3Request.loading}
            clearLabel="No NRM3 classification"
            onChange={setNrm3Code}
          />
        ) : (
          <p className="mt-1.5 text-sm text-gray-500">
            Choosing an NRM3 classification needs access to NRM3 classifications.
          </p>
        )}
        <FieldMessages messages={fieldErrors.nrm3Code} />
        {nrm3Request.error ? (
          <p className="mt-1.5 text-sm text-error-500" role="alert">
            {nrm3Request.error.message}
          </p>
        ) : null}
      </div>
      <TextField
        id="asset-quantity"
        name="quantity"
        label="Quantity"
        type="number"
        step="any"
        value={quantity}
        disabled={pending}
        messages={fieldErrors.quantity}
        onChange={(event) => {
          setQuantity(event.target.value);
        }}
      />
      <TextField
        id="asset-unit"
        name="unitOfMeasure"
        label="Unit of measure"
        maxLength={40}
        value={unitOfMeasure}
        disabled={pending}
        messages={fieldErrors.unitOfMeasure}
        onChange={(event) => {
          setUnitOfMeasure(event.target.value);
        }}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="asset-status">
          Status
        </label>
        <select
          id="asset-status"
          name="status"
          value={status}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            if ((ASSET_STATUSES as readonly string[]).includes(next)) {
              setStatus(next as AssetStatus);
            }
          }}
          className={inputClassName}
        >
          {ASSET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {assetStatusLabel(value)}
            </option>
          ))}
        </select>
        <FieldMessages messages={fieldErrors.status} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : "Add asset"}
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

function validateAssetDraft(draft: {
  locationId: string;
  tag: string;
  assetTypeId: string;
  quantity: string;
  yearOfManufacture: string;
}): FieldErrors | null {
  const errors: FieldErrors = {};

  if (!draft.locationId) {
    errors.locationId = ["Choose a location."];
  }

  if (!draft.tag.trim()) {
    errors.tag = ["Enter a tag."];
  }

  if (!draft.assetTypeId) {
    errors.assetTypeId = ["Choose an asset type."];
  }

  if (draft.quantity.trim() && !Number.isFinite(Number(draft.quantity))) {
    errors.quantity = ["Enter a quantity."];
  }

  const yearError = validateYear(draft.yearOfManufacture);

  if (yearError) {
    errors.yearOfManufacture = [yearError];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function assetPayload(draft: {
  tag: string;
  assetName: string;
  parentAssetId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  yearOfManufacture: string;
  assetTypeId: string;
  nrm3Code: string;
  quantity: string;
  unitOfMeasure: string;
  status: AssetStatus;
}) {
  const payload: Record<string, string | number | null> = {
    tag: draft.tag.trim(),
    assetTypeId: draft.assetTypeId,
    status: draft.status,
    nrm3Code: draft.nrm3Code.trim() || null,
    parentAssetId: draft.parentAssetId.trim() || null,
    manufacturer: emptyToNull(draft.manufacturer),
    model: emptyToNull(draft.model),
    serialNumber: emptyToNull(draft.serialNumber),
    yearOfManufacture: parseYear(draft.yearOfManufacture),
  };
  const name = draft.assetName.trim();
  const unit = draft.unitOfMeasure.trim();

  if (name) {
    payload.assetName = name;
  }

  if (draft.quantity.trim()) {
    payload.quantity = Number(draft.quantity);
  }

  if (unit) {
    payload.unitOfMeasure = unit;
  }

  return payload;
}

function validateYear(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return "Enter a year between 1000 and 9999.";
  }

  const year = Number(trimmed);

  if (year < 1000 || year > 9999) {
    return "Enter a year between 1000 and 9999.";
  }

  return null;
}

function parseYear(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
