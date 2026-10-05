"use client";

import { useState } from "react";
import type { FieldErrors } from "@/lib/api-client";

export const inputClassName =
  "mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60";

export const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-300";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-theme-xs ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

export const cardClassName =
  "rounded-2xl border border-gray-200 bg-white shadow-theme-xs";

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
      {action}
    </div>
  );
}

export function FormBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
      role="alert"
    >
      {message}
    </p>
  );
}

export function FieldMessages({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <p className="mt-1.5 text-sm text-error-500" role="alert">
      {messages.join(" ")}
    </p>
  );
}

export function bannerMessage(
  message: string | null,
  fieldErrors: FieldErrors,
): string | null {
  if (!message) {
    return null;
  }

  if (message === "Invalid request" && Object.keys(fieldErrors).length > 0) {
    return null;
  }

  return message;
}

export function TextField({
  id,
  label,
  messages,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  messages?: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <input id={id} className={inputClassName} {...props} />
      <FieldMessages messages={messages} />
    </div>
  );
}

export function ChoiceGroup({
  legend,
  messages,
  children,
}: {
  legend: string;
  messages?: string[];
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 grid gap-2">{children}</div>
      <FieldMessages messages={messages} />
    </fieldset>
  );
}

export function ConfirmDelete({
  label,
  question,
  pending,
  onConfirm,
}: {
  label: string;
  question: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className={secondaryButtonClassName}
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6">{question}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Deleting…" : label}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={pending}
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Choice({
  checked,
  disabled,
  title,
  detail,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  detail?: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {detail ? (
          <span className="mt-1 block text-sm leading-5 text-gray-500">{detail}</span>
        ) : null}
      </span>
    </label>
  );
}

export function DataTable({
  columns,
  children,
}: {
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div className={`${cardClassName} mt-6 overflow-hidden`}>
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-5 py-3 text-left text-xs font-medium text-gray-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "error" | "success";
}) {
  const tones = {
    light: "bg-gray-100 text-gray-700",
    error: "bg-error-50 text-error-600",
    success: "bg-success-50 text-success-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
