"use client";

import { useState } from "react";
import type { FieldErrors } from "@/lib/api-client";

export const inputClassName =
  "mt-2 h-12 w-full rounded-full border border-line bg-surface px-4 text-sm disabled:opacity-60";

export const primaryButtonClassName =
  "flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground disabled:opacity-60";

export const secondaryButtonClassName =
  "flex h-12 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-medium disabled:opacity-60";

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-4xl font-medium tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

export function FormBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm leading-6 text-ink" role="alert">
      {message}
    </p>
  );
}

export function FieldMessages({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <p className="mt-2 text-sm leading-6 text-ink" role="alert">
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
      <label className="block text-sm font-medium" htmlFor={id}>
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
    <label className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {detail ? (
          <span className="mt-1 block text-sm leading-5 text-muted">{detail}</span>
        ) : null}
      </span>
    </label>
  );
}
