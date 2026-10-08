"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMobileSearch } from "@/components/mobile-search";
import { apiRequest, asApiError } from "@/lib/api-client";
import {
  parseSearchResults,
  searchResultExtra,
  searchResultHref,
  searchResultTypeLabel,
  type SearchResult,
} from "@/lib/search";

export function GlobalSearch() {
  const router = useRouter();
  const {
    expanded: mobileExpanded,
    expand: expandMobileSearch,
    close: closeMobileSearch,
  } = useMobileSearch();
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const requestSeq = useRef(0);
  const timerRef = useRef<number | null>(null);
  const trimmedRef = useRef("");
  const dismissedRef = useRef<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const trimmed = query.trim();
  const pending =
    debouncedQuery.length > 0 && resultsFor !== debouncedQuery && errorFor !== debouncedQuery;

  if (!trimmed && debouncedQuery !== "") {
    setDebouncedQuery("");
  }

  if (!trimmed && open) {
    setOpen(false);
  }

  const showError = open && error !== null && errorFor === debouncedQuery && results.length === 0;
  const showNoResults =
    open && !showError && !pending && resultsFor === debouncedQuery && results.length === 0;
  const showList = open && !showError && results.length > 0;
  const dropdownOpen = showError || showNoResults || showList;
  const activeResult = showList ? results[highlight] : undefined;
  const activeOptionId = activeResult ? optionId(listId, activeResult) : undefined;

  useEffect(() => {
    trimmedRef.current = trimmed;
  }, [trimmed]);

  useEffect(() => {
    if (!mobileExpanded) {
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [mobileExpanded]);

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    const requested = debouncedQuery;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;

    apiRequest(`/api/search?q=${encodeURIComponent(requested)}`)
      .then((body) => {
        if (requestSeq.current !== seq) {
          return;
        }

        setResults(parseSearchResults(body));
        setResultsFor(requested);
        setError(null);
        setErrorFor(null);
        setHighlight(0);

        if (trimmedRef.current.length > 0 && dismissedRef.current !== trimmedRef.current) {
          setOpen(true);
        }
      })
      .catch((caught: unknown) => {
        if (requestSeq.current !== seq) {
          return;
        }

        setResults([]);
        setResultsFor(null);
        setError(asApiError(caught).message);
        setErrorFor(requested);

        if (trimmedRef.current.length > 0 && dismissedRef.current !== trimmedRef.current) {
          setOpen(true);
        }
      });

    return () => {
      requestSeq.current += 1;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        dismissedRef.current = trimmedRef.current;
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (!showList) {
      return;
    }

    optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, showList]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLElement && isTypingTarget(target)) {
        return;
      }

      if (event.repeat || event.isComposing || document.querySelector("dialog[open]")) {
        return;
      }

      event.preventDefault();
      const root = rootRef.current;

      if (root && getComputedStyle(root).display === "none") {
        expandMobileSearch();
        return;
      }

      inputRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [expandMobileSearch]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function scheduleSearch(nextQuery: string) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    const nextTrimmed = nextQuery.trim();
    trimmedRef.current = nextTrimmed;

    if (!nextTrimmed) {
      requestSeq.current += 1;
      dismissedRef.current = null;
      timerRef.current = null;
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setDebouncedQuery(nextTrimmed);
    }, 300);
  }

  function dismiss() {
    dismissedRef.current = trimmedRef.current;
    setOpen(false);
  }

  function choose(result: SearchResult) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    requestSeq.current += 1;
    dismissedRef.current = null;
    trimmedRef.current = "";
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
    setResults([]);
    setResultsFor(null);
    setError(null);
    setErrorFor(null);
    inputRef.current?.blur();
    closeMobileSearch();
    router.push(searchResultHref(result));
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!trimmed) {
        return;
      }

      if (!open) {
        if (!hasSettledContent()) {
          return;
        }

        dismissedRef.current = null;
        setOpen(true);
      }

      if (results.length === 0) {
        return;
      }

      setHighlight((current) => {
        if (event.key === "ArrowDown") {
          return Math.min(current + 1, results.length - 1);
        }

        return Math.max(current - 1, 0);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const result = showList ? results[highlight] : undefined;

      if (result) {
        choose(result);
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        dismiss();
        return;
      }

      if (mobileExpanded) {
        event.preventDefault();
        closeMobileSearch();
      }
    }
  }

  function hasSettledContent() {
    if (results.length > 0) {
      return true;
    }

    return debouncedQuery.length > 0 && !pending && (errorFor === debouncedQuery || resultsFor === debouncedQuery);
  }

  return (
    <div
      ref={rootRef}
      id="workspace-search"
      role="search"
      className={
        mobileExpanded
          ? "fixed inset-x-0 top-16 z-30 border-b border-gray-200 bg-white px-4 py-3 lg:relative lg:inset-auto lg:z-auto lg:mb-6 lg:w-full lg:max-w-xl lg:border-0 lg:bg-transparent lg:p-0"
          : "relative mb-6 hidden w-full max-w-xl scroll-mt-24 lg:block lg:scroll-mt-6"
      }
    >
      <div className="relative">
        <SearchIcon />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          value={query}
          placeholder="Search for sites, locations, assets, work orders"
          aria-label="Search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          aria-controls={showList || showNoResults ? listId : undefined}
          aria-activedescendant={activeOptionId}
          aria-keyshortcuts="/"
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            scheduleSearch(nextQuery);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onKeyDown={onInputKeyDown}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pr-12 pl-10 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden"
        />
        {!focused && query.length === 0 ? (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500 sm:inline"
          >
            /
          </kbd>
        ) : null}
        {dropdownOpen ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-theme-xs">
          {showError ? (
            <p className="px-4 py-3 text-sm text-error-600" role="alert">
              {error}
            </p>
          ) : null}
          {showNoResults || showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search results"
              className="max-h-80 overflow-y-auto py-1"
            >
              {showNoResults ? (
                <li className="px-4 py-3 text-sm text-gray-500">No results</li>
              ) : (
                results.map((result, index) => {
                  const extra = searchResultExtra(result);
                  const selected = index === highlight;

                  return (
                    <li key={`${result.type}:${result.id}`} role="presentation">
                      <button
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        id={optionId(listId, result)}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => {
                          setHighlight(index);
                        }}
                        onClick={() => {
                          choose(result);
                        }}
                        className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left ${
                          selected ? "bg-gray-100" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-xs font-medium text-gray-500">
                          {searchResultTypeLabel(result.type)}
                        </span>
                        <span className="truncate text-sm font-medium text-gray-800">
                          {result.name}
                          {extra ? (
                            <span className="ml-2 font-normal text-gray-500">{extra}</span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-gray-500">{result.client.name}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
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

function optionId(listId: string, result: SearchResult): string {
  return `${listId}-${result.type}-${result.id}`;
}

function isTypingTarget(target: HTMLElement): boolean {
  const tag = target.tagName;

  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
