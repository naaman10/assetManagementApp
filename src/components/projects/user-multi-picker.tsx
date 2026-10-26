"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClassName } from "@/components/form-controls";
import type { ProjectUser } from "@/lib/projects";

export function UserMultiPicker({
  id,
  users,
  value,
  disabled,
  loading,
  placeholder = "Add members",
  searchPlaceholder = "Search people",
  loadingLabel = "Loading people…",
  listLabel = "People",
  emptyLabel = "No members selected.",
  onChange,
}: {
  id: string;
  users: ProjectUser[];
  value: string[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  loadingLabel?: string;
  listLabel?: string;
  emptyLabel?: string;
  onChange: (ids: string[]) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const selected = value
    .map((memberId) => users.find((user) => user.id === memberId))
    .filter((user): user is ProjectUser => Boolean(user));
  const available = filterUsers(
    users.filter((user) => !value.includes(user.id)),
    query,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (rootRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setQuery("");
      setHighlight(0);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function add(memberId: string) {
    if (!memberId || value.includes(memberId) || disabled) {
      return;
    }

    onChange([...value, memberId]);
    setQuery("");
    setHighlight(0);
    searchRef.current?.focus();
  }

  function remove(memberId: string) {
    onChange(value.filter((id) => id !== memberId));
  }

  return (
    <div className="grid gap-3">
      {selected.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {selected.map((user) => (
            <li
              key={user.id}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pr-2 pl-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-800">
                  {userLabel(user)}
                </span>
                {user.name ? (
                  <span className="block truncate text-xs text-gray-500">{user.email}</span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${userLabel(user)}`}
                onClick={() => {
                  remove(user.id);
                }}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
              >
                <span aria-hidden="true" className="block text-base leading-none">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={rootRef} className="relative min-w-0 max-w-full">
        <button
          id={id}
          type="button"
          disabled={disabled || loading}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            if (open) {
              close();
              return;
            }

            setHighlight(0);
            setQuery("");
            setOpen(true);
          }}
          className="flex h-11 w-full max-w-full min-w-0 items-center gap-3 rounded-lg border border-gray-300 bg-transparent py-0 pr-4 pl-3 text-left shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-gray-400">
            {loading
              ? loadingLabel
              : users.length > 0 &&
                  users.every((user) => value.includes(user.id))
                ? "All people selected"
                : placeholder}
          </span>
          <Chevron />
        </button>
        {open ? (
          <div className="absolute top-full right-0 left-0 z-50 mt-1.5 flex max-h-64 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-theme-xs">
            <div className="relative shrink-0">
              <SearchIcon />
              <input
                ref={searchRef}
                type="text"
                value={query}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-label={`Search ${listLabel.toLowerCase()}`}
                placeholder={searchPlaceholder}
                autoComplete="off"
                disabled={disabled}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlight((current) =>
                      available.length === 0 ? 0 : (current + 1) % available.length,
                    );
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlight((current) =>
                      available.length === 0
                        ? 0
                        : (current - 1 + available.length) % available.length,
                    );
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const match = available[highlight];

                    if (match) {
                      add(match.id);
                    }

                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                  }
                }}
                className={`${inputClassName} mt-0 h-9 bg-white pl-9`}
              />
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label={listLabel}
              className="mt-2 min-h-0 flex-1 overflow-y-auto"
            >
              {loading ? (
                <li className="px-3 py-2 text-sm text-gray-500">{loadingLabel}</li>
              ) : available.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">
                  {users.length === 0
                    ? `No ${listLabel.toLowerCase()} yet.`
                    : users.every((user) => value.includes(user.id))
                      ? "All people selected."
                      : `No ${listLabel.toLowerCase()} match.`}
                </li>
              ) : (
                available.map((user, index) => {
                  const active = index === highlight;

                  return (
                    <li key={user.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        disabled={disabled}
                        onMouseEnter={() => {
                          setHighlight(index);
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          add(user.id);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
                          active ? "bg-brand-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-800">
                            {userLabel(user)}
                          </span>
                          {user.name ? (
                            <span className="block text-xs text-gray-500">{user.email}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function filterUsers(users: ProjectUser[], query: string): ProjectUser[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return users;
  }

  return users.filter(
    (user) =>
      user.email.toLowerCase().includes(needle) ||
      (user.name?.toLowerCase().includes(needle) ?? false),
  );
}

function userLabel(user: ProjectUser): string {
  return user.name ?? user.email;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gray-400" fill="none" aria-hidden="true">
      <path
        d="M4.5 6.25 8 9.75l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
