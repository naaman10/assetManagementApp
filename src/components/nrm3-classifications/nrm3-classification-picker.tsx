"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  filterNrm3Tree,
  nrm3Label,
  type Nrm3Classification,
  type Nrm3TreeRow,
} from "@/lib/nrm3-classifications";

type PickerRow =
  | (Nrm3TreeRow & { clear?: false })
  | { code: string; name: string; depth: number; clear: true };

export function Nrm3ClassificationPicker({
  id,
  items,
  value,
  disabled,
  loading,
  startOpen = false,
  listLabel = "NRM3 classifications",
  placeholder = "Choose NRM3 classification",
  searchPlaceholder = "Search classifications",
  loadingLabel = "Loading classifications…",
  clearLabel,
  excludeCodes,
  onDismiss,
  onChange,
}: {
  id: string;
  items: Nrm3Classification[];
  value: string;
  disabled?: boolean;
  loading?: boolean;
  startOpen?: boolean;
  listLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  loadingLabel?: string;
  clearLabel?: string;
  excludeCodes?: ReadonlySet<string>;
  onDismiss?: () => void;
  onChange: (code: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(startOpen);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [highlightQuery, setHighlightQuery] = useState("");
  const available = excludeCodes
    ? items.filter((item) => !excludeCodes.has(item.code))
    : items;
  const selected = available.find((item) => item.code === value) ?? null;
  const matches = pickerRows(available, query, clearLabel);
  const showingClear = !selected && !loading && Boolean(clearLabel);

  if (query !== highlightQuery) {
    setHighlightQuery(query);
    setHighlight(0);
  }

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
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, matches.length]);

  function close(focusButton: boolean, dismiss = true) {
    setOpen(false);
    setQuery("");

    if (dismiss) {
      onDismiss?.();
    }

    if (focusButton) {
      buttonRef.current?.focus();
    }
  }

  function choose(code: string) {
    onChange(code);
    close(false, false);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) =>
        matches.length === 0 ? 0 : (current + 1) % matches.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) =>
        matches.length === 0 ? 0 : (current - 1 + matches.length) % matches.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const match = matches[highlight];

      if (match) {
        choose(match.code);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  const activeMatch = matches[highlight];
  const activeId = activeMatch
    ? `${listId}-${activeMatch.clear ? "clear" : activeMatch.code}`
    : undefined;

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={selected || showingClear ? `${id}-label ${id}-value` : `${id}-label`}
        onClick={() => {
          if (open) {
            close(false);
            return;
          }

          const index = pickerRows(available, "", clearLabel).findIndex(
            (row) => row.code === value,
          );
          setHighlight(index >= 0 ? index : 0);
          setHighlightQuery("");
          setQuery("");
          setOpen(true);
        }}
        className="flex h-11 w-full items-center gap-3 rounded-lg border border-gray-300 bg-transparent py-0 pr-4 pl-3 text-left shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
      >
        {selected ? (
          <>
            <TypeMark label={levelMark(selected.level)} />
            <span id={`${id}-value`} className="min-w-0 flex-1 truncate text-sm text-gray-800">
              {nrm3Label(selected)}
            </span>
          </>
        ) : showingClear ? (
          <>
            <TypeMark empty />
            <span id={`${id}-value`} className="min-w-0 flex-1 truncate text-sm text-gray-800">
              {clearLabel}
            </span>
          </>
        ) : (
          <>
            <TypeMark empty />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-400">
              {loading ? loadingLabel : placeholder}
            </span>
          </>
        )}
        <Chevron />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1.5 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-theme-xs">
          <div className="relative">
            <SearchIcon />
            <input
              ref={searchRef}
              type="text"
              value={query}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-label={`Search ${listLabel.toLowerCase()}`}
              placeholder={searchPlaceholder}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              onKeyDown={onSearchKeyDown}
              className="h-9 w-full rounded-lg border border-gray-300 bg-transparent pr-3 pl-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={listLabel}
            className="mt-2 max-h-60 overflow-y-auto"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">
                {available.length === 0
                  ? `No ${listLabel.toLowerCase()} yet.`
                  : `No ${listLabel.toLowerCase()} match.`}
              </li>
            ) : (
              matches.map((row, index) => {
                const isSelected = row.clear ? value === "" : row.code === value;
                const isActive = index === highlight;

                return (
                  <li key={row.clear ? "clear" : row.code}>
                    <button
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      id={`${listId}-${row.clear ? "clear" : row.code}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => {
                        setHighlight(index);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        choose(row.code);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
                        isSelected || isActive ? "bg-brand-50" : "hover:bg-gray-50"
                      }`}
                      style={row.clear ? undefined : { paddingLeft: 8 + row.depth * 12 }}
                    >
                      {row.clear ? (
                        <TypeMark empty />
                      ) : (
                        <TypeMark label={levelMark(row.level)} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-800">
                          {row.name}
                        </span>
                        {row.clear ? null : (
                          <span className="block truncate text-xs text-gray-500">
                            {row.code}
                            {row.depth > 0 && row.parentCode
                              ? ` · under ${row.parentCode}`
                              : ""}
                          </span>
                        )}
                      </span>
                      {isSelected ? <CheckIcon /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function pickerRows(
  items: Nrm3Classification[],
  query: string,
  clearLabel?: string,
): PickerRow[] {
  const filtered = filterNrm3Tree(items, query);
  const needle = query.trim().toLowerCase();

  if (!clearLabel || (needle && !clearLabel.toLowerCase().includes(needle))) {
    return filtered;
  }

  return [{ code: "", name: clearLabel, depth: 0, clear: true }, ...filtered];
}

function levelMark(level: number): string {
  return String(level);
}

function TypeMark({ label, empty }: { label?: string; empty?: boolean }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-medium ${
        empty ? "bg-gray-100 text-gray-400" : "bg-brand-50 text-brand-500"
      }`}
      aria-hidden="true"
    >
      {empty ? <PersonIcon /> : label}
    </span>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
      <circle cx="8" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 12.25c.6-1.8 2.2-2.75 4.5-2.75s3.9.95 4.5 2.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gray-500" fill="none" aria-hidden="true">
      <path
        d="M4 6.5 8 10.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-brand-500" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.25 6.5 11.25 12.5 4.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
