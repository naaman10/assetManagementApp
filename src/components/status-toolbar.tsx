"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { asApiError, type ApiRequestError } from "@/lib/api-client";

export type StatusOption = {
  value: string;
  label: string;
};

export type StatusMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export function StatusToolbar({
  value,
  options,
  editable,
  onChange,
  menuItems = [],
}: {
  value: string;
  options: readonly StatusOption[];
  editable: boolean;
  onChange: (value: string) => Promise<void>;
  menuItems?: StatusMenuItem[];
}) {
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? value;
  const active = value === "active";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusLozenge
        label={label}
        active={active}
        editable={editable}
        value={value}
        options={options}
        onChange={onChange}
      />
      <MoreMenu items={menuItems} />
    </div>
  );
}

function StatusLozenge({
  label,
  active,
  editable,
  value,
  options,
  onChange,
}: {
  label: string;
  active: boolean;
  editable: boolean;
  value: string;
  options: readonly StatusOption[];
  onChange: (value: string) => Promise<void>;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const canPortal = typeof document !== "undefined";
  const toneClass = active
    ? "bg-[#DDF4AF] text-gray-800 ring-[#c5e08c] hover:bg-[#d0ee9a]"
    : "bg-gray-100 text-gray-700 ring-gray-200 hover:bg-gray-200";

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = Math.max(rect.width, 11 * 16);
      let left = rect.left;

      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - 8 - width;
      }

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: Math.max(8, left),
        width,
        zIndex: 80,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setMenuStyle(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function choose(next: string) {
    if (!editable || pending || next === value) {
      setOpen(false);
      setMenuStyle(null);
      return;
    }

    setPending(true);
    setError(null);

    try {
      await onChange(next);
      setOpen(false);
      setMenuStyle(null);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  if (!editable) {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset ${toneClass}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            setMenuStyle(null);
            return;
          }

          setError(null);
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset disabled:opacity-50 ${toneClass}`}
      >
        {label}
        <Chevron />
      </button>
      {error ? (
        <p className="mt-1.5 text-sm text-error-500" role="alert">
          {error.message}
        </p>
      ) : null}
      {open && canPortal && menuStyle
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-label="Status"
              style={menuStyle}
              className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-theme-xs"
            >
              {options.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={pending}
                    onClick={() => {
                      void choose(option.value);
                    }}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                      selected ? "bg-brand-50 font-medium text-brand-600" : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MoreMenu({ items }: { items: StatusMenuItem[] }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const canPortal = typeof document !== "undefined";

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = 12 * 16;
      let left = rect.right - width;

      if (left < 8) {
        left = 8;
      }

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        width,
        zIndex: 80,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setMenuStyle(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            setMenuStyle(null);
            return;
          }

          setOpen(true);
        }}
        className="inline-flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800"
      >
        <MoreIcon />
      </button>
      {open && canPortal && menuStyle
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={menuStyle}
              className="rounded-lg border border-gray-200 bg-white py-1 shadow-theme-xs"
            >
              {items.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">No actions available</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      setMenuStyle(null);
                      item.onSelect();
                    }}
                    className={`flex w-full px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      item.tone === "danger"
                        ? "text-error-600 hover:bg-error-50"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 opacity-70" fill="none" aria-hidden="true">
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}
