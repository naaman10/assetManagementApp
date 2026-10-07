"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AddressFields } from "@/components/clients/client-form";
import {
  FieldMessages,
  FormBanner,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { ApiRequestError, asApiError, type FieldErrors } from "@/lib/api-client";
import type { Address } from "@/lib/clients";

export function PropertyGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </dl>
  );
}

export function InlineTitle({
  value,
  display,
  editable,
  field = "name",
  maxLength = 200,
  onSave,
}: {
  value: string;
  display?: string;
  editable: boolean;
  field?: string;
  maxLength?: number;
  onSave: (value: string) => Promise<void>;
}) {
  const editor = useInlineCommit(value, onSave);
  const inputId = useId();
  const shown = display ?? (value || "—");

  if (!editable) {
    return <h1 className="mt-1 text-2xl font-semibold text-gray-800">{shown}</h1>;
  }

  if (!editor.editing) {
    return (
      <h1 className="mt-1 text-2xl font-semibold text-gray-800">
        <button
          type="button"
          className={valueButtonClassName}
          onClick={() => {
            editor.open();
          }}
        >
          {shown}
        </button>
      </h1>
    );
  }

  return (
    <div className="mt-1">
      <input
        id={inputId}
        aria-label="Name"
        autoFocus
        placeholder="Name"
        maxLength={maxLength}
        defaultValue={value}
        disabled={editor.pending}
        className={inputClassName}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            editor.cancel();
          }

          if (event.key === "Enter") {
            event.preventDefault();
            void editor.commit(event.currentTarget.value);
          }
        }}
        onBlur={(event) => {
          void editor.commit(event.currentTarget.value);
        }}
      />
      <FieldError error={editor.error} field={field} />
    </div>
  );
}

export function InlineText({
  label,
  value,
  editable,
  field,
  wide = false,
  type = "text",
  maxLength,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  field: string;
  wide?: boolean;
  type?: string;
  maxLength?: number;
  onSave: (value: string) => Promise<void>;
}) {
  const editor = useInlineCommit(value, onSave);
  const inputId = useId();

  return (
    <Property label={label} wide={wide}>
      {editable && editor.editing ? (
        <>
          <input
            id={inputId}
            aria-label={label}
            type={type}
            autoFocus
            maxLength={maxLength}
            defaultValue={value}
            disabled={editor.pending}
            className={inputClassName}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                editor.cancel();
              }

              if (event.key === "Enter") {
                event.preventDefault();
                void editor.commit(event.currentTarget.value);
              }
            }}
            onBlur={(event) => {
              void editor.commit(event.currentTarget.value);
            }}
          />
          <FieldError error={editor.error} field={field} />
        </>
      ) : editable ? (
        <button
          type="button"
          className={valueButtonClassName}
          onClick={() => {
            editor.open();
          }}
        >
          {value || "—"}
        </button>
      ) : (
        <span className="whitespace-pre-line">{value || "—"}</span>
      )}
    </Property>
  );
}

export function InlineSelect({
  label,
  value,
  options,
  editable,
  field,
  aside,
  onSave,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  editable: boolean;
  field: string;
  aside?: React.ReactNode;
  onSave: (value: string) => Promise<void>;
}) {
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const inputId = useId();
  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? (value || "—");
  const choices =
    !value || options.some((option) => option.value === value)
      ? options
      : [{ value, label: display }, ...options];

  async function commit(next: string) {
    if (saving.current || next === value) {
      return;
    }

    saving.current = true;
    setPending(true);
    setError(null);

    try {
      await onSave(next);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <Property label={label}>
      {editable ? (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id={inputId}
              aria-label={label}
              value={value}
              disabled={pending}
              className={`${inputClassName} mt-0 min-w-48 flex-1`}
              onChange={(event) => {
                void commit(event.target.value);
              }}
            >
              {choices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {aside}
          </div>
          <FieldError error={error} field={field} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span>{display}</span>
          {aside}
        </div>
      )}
    </Property>
  );
}

export function InlineAddress({
  address,
  editable,
  onSave,
}: {
  address: Address;
  editable: boolean;
  onSave: (address: Record<string, string | null>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(address);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefix = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setError(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setError(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const display = formatAddress(address);
  const fieldErrors = error?.fieldErrors ?? {};

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const local = addressErrors(draft);

    if (local) {
      setError(new ApiRequestError(400, "Invalid request", local));
      return;
    }

    const patch = changedAddress(address, draft);

    if (!patch) {
      setOpen(false);
      setError(null);
      return;
    }

    setPending(true);
    setError(null);

    try {
      await onSave(patch);
      setOpen(false);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Property label="Address" wide>
      <div className="relative" ref={panelRef}>
        {editable ? (
          <button
            type="button"
            className={`${valueButtonClassName} whitespace-pre-line`}
            onClick={() => {
              setDraft(address);
              setError(null);
              setOpen(true);
            }}
          >
            {display || "—"}
          </button>
        ) : (
          <span className="whitespace-pre-line">{display || "—"}</span>
        )}
        {open ? (
          <form
            role="dialog"
            aria-label="Address"
            className="absolute z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs"
            onSubmit={(event) => {
              void save(event);
            }}
          >
            <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
            <AddressFields
              idPrefix={prefix}
              line1={draft.line1}
              line2={draft.line2 ?? ""}
              city={draft.city}
              county={draft.county ?? ""}
              postcode={draft.postcode}
              country={draft.country}
              pending={pending}
              fieldErrors={fieldErrors}
              onLine1={(line1) => {
                setDraft((current) => ({ ...current, line1 }));
              }}
              onLine2={(line2) => {
                setDraft((current) => ({ ...current, line2 }));
              }}
              onCity={(city) => {
                setDraft((current) => ({ ...current, city }));
              }}
              onCounty={(county) => {
                setDraft((current) => ({ ...current, county }));
              }}
              onPostcode={(postcode) => {
                setDraft((current) => ({ ...current, postcode }));
              }}
              onCountry={(country) => {
                setDraft((current) => ({ ...current, country }));
              }}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" disabled={pending} className={primaryButtonClassName}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={pending}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </Property>
  );
}

export function changedAddress(
  current: Address,
  draft: {
    line1: string;
    line2: string | null;
    city: string;
    county: string | null;
    postcode: string;
    country: string;
  },
): Record<string, string | null> | null {
  const next = {
    line1: draft.line1.trim(),
    line2: emptyToNull(draft.line2 ?? ""),
    city: draft.city.trim(),
    county: emptyToNull(draft.county ?? ""),
    postcode: draft.postcode.trim(),
    country: draft.country.trim(),
  };
  const address: Record<string, string | null> = {};

  if (next.line1 !== current.line1) {
    address.line1 = next.line1;
  }

  if (next.line2 !== current.line2) {
    address.line2 = next.line2;
  }

  if (next.city !== current.city) {
    address.city = next.city;
  }

  if (next.county !== current.county) {
    address.county = next.county;
  }

  if (next.postcode !== current.postcode) {
    address.postcode = next.postcode;
  }

  if (next.country !== current.country) {
    address.country = next.country;
  }

  return Object.keys(address).length > 0 ? address : null;
}

export function Property({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2 xl:col-span-3" : undefined}>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-800">{children}</dd>
    </div>
  );
}

function FieldError({
  error,
  field,
}: {
  error: ApiRequestError | null;
  field: string;
}) {
  if (!error) {
    return null;
  }

  const messages = error.fieldErrors[field];

  return (
    <>
      <FormBanner message={bannerMessage(error.message, error.fieldErrors)} />
      <FieldMessages messages={messages} />
    </>
  );
}

function useInlineCommit(value: string, onSave: (value: string) => Promise<void>) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  function open() {
    setError(null);
    setEditing(true);
  }

  function cancel() {
    saving.current = true;
    setEditing(false);
    setError(null);
    setPending(false);
    queueMicrotask(() => {
      saving.current = false;
    });
  }

  async function commit(raw: string) {
    if (saving.current) {
      return;
    }

    const next = raw.trim();

    if (next === value) {
      setEditing(false);
      setError(null);
      return;
    }

    saving.current = true;
    setPending(true);
    setError(null);

    try {
      await onSave(next);
      setEditing(false);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return { editing, error, pending, open, cancel, commit };
}

function addressErrors(draft: Address): FieldErrors | null {
  const errors: FieldErrors = {};

  if (!draft.line1.trim()) {
    errors["address.line1"] = ["Enter an address line."];
  }

  if (!draft.city.trim()) {
    errors["address.city"] = ["Enter a city."];
  }

  if (!draft.postcode.trim()) {
    errors["address.postcode"] = ["Enter a postcode."];
  }

  if (!draft.country.trim()) {
    errors["address.country"] = ["Enter a country."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function formatAddress(address: Address): string {
  return [address.line1, address.line2, address.city, address.county, address.postcode, address.country]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const valueButtonClassName =
  "rounded-md px-2 py-1 -mx-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-hidden";
