"use client";

import { useState } from "react";
import { FormBanner, bannerMessage } from "@/components/form-controls";
import { ApiRequestError, asApiError } from "@/lib/api-client";
import {
  PROJECT_TYPE_FIELD_SOURCES,
  fieldRefId,
  normalizeProjectTypeFields,
  projectTypeFieldSourceLabel,
  type ProjectType,
  type ProjectTypeFieldCatalogItem,
  type ProjectTypeFieldRef,
  type ProjectTypeFieldSource,
} from "@/lib/project-types";

type DragPayload =
  | { from: "selected"; id: string; source: ProjectTypeFieldSource }
  | { from: "available"; id: string; source: ProjectTypeFieldSource };

type SelectedDropHint = {
  source: ProjectTypeFieldSource;
  index: number;
};

const dragMime = "application/x-project-type-field";

export function ProjectTypeFields({
  projectType,
  catalog,
  catalogLoading,
  catalogError,
  canEdit,
  pending,
  onSaveFields,
}: {
  projectType: ProjectType;
  catalog: ProjectTypeFieldCatalogItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  canEdit: boolean;
  pending: boolean;
  onSaveFields: (fields: ProjectTypeFieldRef[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<ApiRequestError | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<"selected" | "available" | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<SelectedDropHint | null>(null);
  const [availableExpanded, setAvailableExpanded] = useState<
    Record<ProjectTypeFieldSource, boolean>
  >({
    asset: true,
    maintenance_history: false,
    survey_record: false,
  });
  const [selectedExpanded, setSelectedExpanded] = useState<
    Record<ProjectTypeFieldSource, boolean>
  >({
    asset: true,
    maintenance_history: true,
    survey_record: true,
  });
  const selectedIds = new Set(projectType.fields.map(fieldRefId));
  const available = catalog.filter((field) => !selectedIds.has(fieldRefId(field)));
  const matches = filterCatalog(available, query);
  const catalogById = new Map(catalog.map((field) => [fieldRefId(field), field]));
  const selectedBySource = groupSelected(projectType.fields);
  const disabled = !canEdit || pending;

  async function save(next: ProjectTypeFieldRef[]) {
    setActionError(null);

    try {
      await onSaveFields(normalizeProjectTypeFields(next));
    } catch (caught) {
      setActionError(asApiError(caught));
    }
  }

  function toRef(item: ProjectTypeFieldCatalogItem): ProjectTypeFieldRef {
    return {
      source: item.source,
      key: item.key,
      label: item.label,
      type: item.type,
      required: false,
      sortOrder: 0,
    };
  }

  async function setFieldRequired(id: string, required: boolean) {
    if (disabled) {
      return;
    }

    const next = projectType.fields.map((field) =>
      fieldRefId(field) === id ? { ...field, required } : field,
    );

    await save(next);
  }

  async function addFields(items: ProjectTypeFieldCatalogItem[]) {
    if (disabled || items.length === 0) {
      return;
    }

    const incoming = items.filter((item) => !selectedIds.has(fieldRefId(item)));

    if (incoming.length === 0) {
      return;
    }

    let next = [...projectType.fields];

    for (const item of incoming) {
      next = insertIntoSourceGroup(next, toRef(item));
    }

    await save(next);
  }

  async function removeField(id: string) {
    if (disabled) {
      return;
    }

    await save(projectType.fields.filter((item) => fieldRefId(item) !== id));
  }

  async function removeSource(source: ProjectTypeFieldSource) {
    if (disabled) {
      return;
    }

    await save(projectType.fields.filter((item) => item.source !== source));
  }

  async function applyDrop(
    payload: DragPayload,
    target: "selected" | "available",
    hint?: SelectedDropHint | null,
  ) {
    if (disabled) {
      return;
    }

    if (payload.from === "available" && target === "selected") {
      const item = catalogById.get(payload.id);

      if (!item || selectedIds.has(payload.id)) {
        return;
      }

      const insertHint =
        hint && hint.source === item.source
          ? hint
          : { source: item.source, index: selectedBySource[item.source].length };

      await save(insertIntoSourceGroup(projectType.fields, toRef(item), insertHint.index));
      return;
    }

    if (payload.from === "selected" && target === "available") {
      await removeField(payload.id);
      return;
    }

    if (payload.from === "selected" && target === "selected") {
      if (!hint || hint.source !== payload.source) {
        return;
      }

      const group = selectedBySource[payload.source];
      const fromIndex = group.findIndex((item) => fieldRefId(item) === payload.id);

      if (fromIndex < 0) {
        return;
      }

      const nextGroup = [...group];
      const [item] = nextGroup.splice(fromIndex, 1);
      let insertAt = Math.max(0, Math.min(hint.index, nextGroup.length));

      if (fromIndex < insertAt) {
        insertAt -= 1;
      }

      nextGroup.splice(insertAt, 0, item);

      const next = PROJECT_TYPE_FIELD_SOURCES.flatMap((source) =>
        source === payload.source ? nextGroup : selectedBySource[source],
      );

      await save(next);
    }
  }

  function readPayload(event: React.DragEvent): DragPayload | null {
    const raw = event.dataTransfer.getData(dragMime) || event.dataTransfer.getData("text/plain");

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as DragPayload;

      if (
        (parsed.from === "selected" || parsed.from === "available") &&
        typeof parsed.id === "string" &&
        (PROJECT_TYPE_FIELD_SOURCES as readonly string[]).includes(parsed.source)
      ) {
        return parsed;
      }
    } catch {
      return null;
    }

    return null;
  }

  function onDragStart(event: React.DragEvent, payload: DragPayload) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(dragMime, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    setDraggingId(payload.id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
    setSelectedDrop(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FormBanner
        message={bannerMessage(actionError?.message ?? null, actionError?.fieldErrors ?? {})}
      />

      {catalogLoading ? (
        <p className="text-sm text-gray-500">Loading fields…</p>
      ) : catalogError ? (
        <p className="text-sm text-error-500" role="alert">
          {catalogError}
        </p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            disabled={disabled}
            placeholder="Search fields"
            aria-label="Search fields"
            autoComplete="off"
            className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <section
              className={`flex min-h-80 min-w-0 flex-col rounded-lg border bg-white ${
                dropTarget === "selected" ? "border-brand-500" : "border-gray-200"
              }`}
              onDragOver={(event) => {
                if (disabled) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget("selected");
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  if (dropTarget === "selected") {
                    setDropTarget(null);
                    setSelectedDrop(null);
                  }
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const payload = readPayload(event);
                const hint = selectedDrop;
                onDragEnd();

                if (payload) {
                  void applyDrop(payload, "selected", hint);
                }
              }}
            >
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  Fields to display
                  {projectType.fields.length > 0 ? (
                    <span className="ml-2 font-medium text-gray-500">
                      {projectType.fields.length}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Grouped by source. Reorder within each group.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {projectType.fields.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-500">
                    No fields selected yet.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {PROJECT_TYPE_FIELD_SOURCES.map((source) => {
                      const group = selectedBySource[source];

                      if (group.length === 0) {
                        return null;
                      }

                      const isOpen = selectedExpanded[source];

                      return (
                        <div
                          key={source}
                          className="overflow-hidden rounded-lg border border-gray-200"
                          onDragOver={(event) => {
                            if (disabled) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            setDropTarget("selected");

                            if (!selectedDrop || selectedDrop.source !== source) {
                              setSelectedDrop({ source, index: group.length });
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              aria-expanded={isOpen}
                              onClick={() => {
                                setSelectedExpanded((current) => ({
                                  ...current,
                                  [source]: !current[source],
                                }));
                              }}
                            >
                              <Chevron open={isOpen} />
                              <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                                {projectTypeFieldSourceLabel(source)}
                              </span>
                              <span className="text-xs text-gray-500">{group.length}</span>
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={pending}
                                className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
                                onClick={() => {
                                  void removeSource(source);
                                }}
                              >
                                Remove all
                              </button>
                            ) : null}
                          </div>
                          {isOpen ? (
                            <ul className="grid gap-1 p-2">
                              {group.map((field, index) => {
                                const id = fieldRefId(field);
                                const catalogField = catalogById.get(id);

                                return (
                                  <li key={id}>
                                    {dropTarget === "selected" &&
                                    selectedDrop?.source === source &&
                                    selectedDrop.index === index ? (
                                      <DropMarker />
                                    ) : null}
                                    <FieldCard
                                      label={field.label}
                                      detail={
                                        (catalogField?.type ?? field.type) === "media"
                                          ? "media · Uploaded after the survey is saved on the asset capture form."
                                          : (catalogField?.type ?? field.type)
                                      }
                                      draggable={canEdit && !pending}
                                      dragging={draggingId === id}
                                      onDragStart={(event) => {
                                        onDragStart(event, {
                                          from: "selected",
                                          id,
                                          source: field.source,
                                        });
                                      }}
                                      onDragEnd={onDragEnd}
                                      onDragOver={(event) => {
                                        if (disabled) {
                                          return;
                                        }

                                        event.preventDefault();
                                        event.stopPropagation();
                                        setDropTarget("selected");
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        const before =
                                          event.clientY < rect.top + rect.height / 2;
                                        setSelectedDrop({
                                          source,
                                          index: before ? index : index + 1,
                                        });
                                      }}
                                      action={
                                        <div
                                          className="flex shrink-0 items-center gap-3"
                                          data-no-drag
                                          onMouseDown={(event) => {
                                            event.stopPropagation();
                                          }}
                                        >
                                          <RequiredSwitch
                                            checked={field.required}
                                            disabled={!canEdit || pending}
                                            label={`${field.label} required`}
                                            onChange={(required) => {
                                              void setFieldRequired(id, required);
                                            }}
                                          />
                                          {canEdit ? (
                                            <button
                                              type="button"
                                              disabled={pending}
                                              className="text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
                                              onClick={() => {
                                                void removeField(id);
                                              }}
                                            >
                                              Remove
                                            </button>
                                          ) : null}
                                        </div>
                                      }
                                    />
                                  </li>
                                );
                              })}
                              {dropTarget === "selected" &&
                              selectedDrop?.source === source &&
                              selectedDrop.index === group.length ? (
                                <DropMarker />
                              ) : null}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section
              className={`flex min-h-80 min-w-0 flex-col rounded-lg border bg-white ${
                dropTarget === "available" ? "border-brand-500" : "border-gray-200"
              }`}
              onDragOver={(event) => {
                if (disabled) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget("available");
                setSelectedDrop(null);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  if (dropTarget === "available") {
                    setDropTarget(null);
                  }
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const payload = readPayload(event);
                onDragEnd();

                if (payload) {
                  void applyDrop(payload, "available");
                }
              }}
            >
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">Fields to add</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Expand a group to pick fields, or add all at once.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {available.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-500">All fields added.</p>
                ) : matches.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-500">No fields match.</p>
                ) : (
                  <div className="grid gap-2">
                    {PROJECT_TYPE_FIELD_SOURCES.map((source) => {
                      const group = matches.filter((field) => field.source === source);

                      if (group.length === 0) {
                        return null;
                      }

                      const isOpen = availableExpanded[source];

                      return (
                        <div
                          key={source}
                          className="overflow-hidden rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              aria-expanded={isOpen}
                              onClick={() => {
                                setAvailableExpanded((current) => ({
                                  ...current,
                                  [source]: !current[source],
                                }));
                              }}
                            >
                              <Chevron open={isOpen} />
                              <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                                {projectTypeFieldSourceLabel(source)}
                              </span>
                              <span className="text-xs text-gray-500">{group.length}</span>
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={pending}
                                className="shrink-0 text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                                onClick={() => {
                                  void addFields(group);
                                }}
                              >
                                Add all
                              </button>
                            ) : null}
                          </div>
                          {isOpen ? (
                            <ul className="grid gap-1 p-2">
                              {group.map((field) => {
                                const id = fieldRefId(field);

                                return (
                                  <li key={id}>
                                    <FieldCard
                                      label={field.label}
                                      detail={
                                        field.type === "media"
                                          ? field.description
                                            ? `media · ${field.description}`
                                            : "media · Uploaded after the survey is saved on the asset capture form."
                                          : field.description
                                            ? `${field.type} · ${field.description}`
                                            : field.type
                                      }
                                      draggable={canEdit && !pending}
                                      dragging={draggingId === id}
                                      onDragStart={(event) => {
                                        onDragStart(event, {
                                          from: "available",
                                          id,
                                          source: field.source,
                                        });
                                      }}
                                      onDragEnd={onDragEnd}
                                      action={
                                        canEdit ? (
                                          <button
                                            type="button"
                                            disabled={pending}
                                            className="text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                                            onClick={() => {
                                              void addFields([field]);
                                            }}
                                          >
                                            Add
                                          </button>
                                        ) : null
                                      }
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function groupSelected(
  fields: ProjectTypeFieldRef[],
): Record<ProjectTypeFieldSource, ProjectTypeFieldRef[]> {
  return {
    asset: fields.filter((field) => field.source === "asset"),
    maintenance_history: fields.filter((field) => field.source === "maintenance_history"),
    survey_record: fields.filter((field) => field.source === "survey_record"),
  };
}

function insertIntoSourceGroup(
  fields: ProjectTypeFieldRef[],
  item: ProjectTypeFieldRef,
  indexWithinGroup?: number,
): ProjectTypeFieldRef[] {
  const grouped = groupSelected(fields);
  const group = [...grouped[item.source]];
  const insertAt =
    typeof indexWithinGroup === "number"
      ? Math.max(0, Math.min(indexWithinGroup, group.length))
      : group.length;

  group.splice(insertAt, 0, item);
  grouped[item.source] = group;

  return PROJECT_TYPE_FIELD_SOURCES.flatMap((source) => grouped[source]);
}

function FieldCard({
  label,
  detail,
  draggable,
  dragging,
  action,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  label: string;
  detail: string;
  draggable: boolean;
  dragging: boolean;
  action?: React.ReactNode;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver?: (event: React.DragEvent) => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if ((event.target as HTMLElement | null)?.closest?.("[data-no-drag]")) {
          event.preventDefault();
          return;
        }

        onDragStart(event);
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
        dragging
          ? "border-brand-300 bg-brand-50 opacity-70"
          : "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable ? <DragHandle /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{label}</p>
        <p className="truncate text-xs text-gray-500">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function RequiredSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500">Required</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        data-no-drag
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-200"
        } disabled:cursor-not-allowed disabled:opacity-50`}
        onClick={() => {
          onChange(!checked);
        }}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-4 rounded-full bg-white shadow-theme-xs transition ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function DropMarker() {
  return <div className="my-1 h-0.5 rounded-full bg-brand-500" aria-hidden="true" />;
}

function DragHandle() {
  return (
    <span className="shrink-0 text-gray-400" aria-hidden="true">
      <svg viewBox="0 0 12 16" className="size-3.5" fill="currentColor">
        <circle cx="3" cy="3" r="1.2" />
        <circle cx="9" cy="3" r="1.2" />
        <circle cx="3" cy="8" r="1.2" />
        <circle cx="9" cy="8" r="1.2" />
        <circle cx="3" cy="13" r="1.2" />
        <circle cx="9" cy="13" r="1.2" />
      </svg>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 text-gray-500 transition ${open ? "rotate-90" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 4.5 9.5 8 6 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function filterCatalog(
  fields: ProjectTypeFieldCatalogItem[],
  query: string,
): ProjectTypeFieldCatalogItem[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return fields;
  }

  return fields.filter(
    (field) =>
      field.label.toLowerCase().includes(needle) ||
      field.key.toLowerCase().includes(needle) ||
      field.type.toLowerCase().includes(needle) ||
      projectTypeFieldSourceLabel(field.source).toLowerCase().includes(needle) ||
      (field.description?.toLowerCase().includes(needle) ?? false),
  );
}
