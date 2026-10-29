"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { assetStatusLabel } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  FieldMessages,
  FormBanner,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { ProjectAssetCaptureField } from "@/components/projects/project-asset-capture-field";
import { ReviewStatusBadge } from "@/components/projects/review-status-badge";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError } from "@/lib/api-client";
import {
  availableCaptureTabs,
  buildCapturePutBody,
  emptySectionValues,
  fetchProjectAssetCapture,
  fieldErrorKey,
  fieldsForSource,
  initialCaptureValues,
  isSectionDirty,
  mapApiFieldPaths,
  saveProjectAssetCapture,
  validateCaptureValues,
  withMaintenanceCreateFields,
  type CaptureField,
  type CaptureSource,
  type CaptureValues,
  type ProjectAssetCapture,
} from "@/lib/project-asset-capture";
import {
  PROJECT_ASSET_REVIEW_STATUSES,
  parseProjectAssetReviewBody,
  reviewStatusLabel,
  type ProjectAssetReviewStatus,
} from "@/lib/projects";
import { ASSET_STATUSES, type AssetStatus } from "@/lib/sites";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function ProjectAssetCapturePage({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) {
  const { user } = useSession();
  const tablistId = useId();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canEdit = hasPermission(user, CLIENTS_EDIT);
  const [capture, setCapture] = useState<ProjectAssetCapture | null>(null);
  const [values, setValues] = useState<CaptureValues | null>(null);
  const [tab, setTab] = useState<CaptureSource>("asset");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const projectHref = `/projects/${projectId}`;

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setLoadError(null);
    setCapture(null);
    setValues(null);

    fetchProjectAssetCapture(projectId, assetId)
      .then((next) => {
        if (cancelled) {
          return;
        }

        const fields = withMaintenanceCreateFields(next.fields);
        setCapture(next);
        setValues(initialCaptureValues(fields));
        setTab(availableCaptureTabs(fields)[0]?.source ?? "asset");
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(asApiError(caught));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, canView, projectId]);

  if (!canView) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        You do not have access to this project.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading capture form…</p>;
  }

  if (loadError?.status === 404) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <Breadcrumbs
          current
          items={[
            { label: "Projects", href: "/projects" },
            { label: "Project", href: projectHref },
            { label: "Asset" },
          ]}
        />
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-gray-800">
            This asset was not found on the project.
          </p>
          <Link
            href={projectHref}
            className={`${secondaryButtonClassName} mt-5 inline-flex`}
          >
            Back to project
          </Link>
        </div>
      </div>
    );
  }

  if (loadError || !capture || !values) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {loadError ? asApiError(loadError).message : "The capture form could not be loaded."}
      </p>
    );
  }

  const fields = withMaintenanceCreateFields(capture.fields);
  const tabs = availableCaptureTabs(fields);
  const title =
    capture.asset.assetName != null && capture.asset.assetName.length > 0
      ? `${capture.asset.tag} · ${capture.asset.assetName}`
      : capture.asset.tag;

  function setFieldValue(source: CaptureSource, key: string, value: unknown) {
    setValues((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [source]: {
          ...current[source],
          [key]: value,
        },
      };
    });
    setSuccess(null);
  }

  async function setReviewStatus(reviewStatus: ProjectAssetReviewStatus) {
    if (!canEdit || !capture || reviewPending || reviewStatus === capture.asset.reviewStatus) {
      return;
    }

    const previous = capture.asset.reviewStatus;
    setCapture({
      ...capture,
      asset: { ...capture.asset, reviewStatus },
    });
    setReviewPending(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = parseProjectAssetReviewBody(
        await apiRequest(`/api/projects/${projectId}/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify({ reviewStatus }),
        }),
      );
      setCapture((current) =>
        current
          ? {
              ...current,
              asset: { ...current.asset, reviewStatus: updated.reviewStatus },
            }
          : current,
      );
      setSuccess(`Review status set to ${reviewStatusLabel(updated.reviewStatus)}.`);
    } catch (caught) {
      const apiError = asApiError(caught);
      setCapture((current) =>
        current
          ? {
              ...current,
              asset: { ...current.asset, reviewStatus: previous },
            }
          : current,
      );

      if (apiError.status === 404) {
        setLoadError(apiError);
        return;
      }

      setError(apiError);
    } finally {
      setReviewPending(false);
    }
  }

  async function save() {
    if (!canEdit || !values || pending) {
      return;
    }

    const clientErrors = validateCaptureValues(fields, values);

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError(new ApiRequestError(400, "Invalid request", clientErrors));
      const firstSource = firstErrorSource(clientErrors, tabs.map((item) => item.source));

      if (firstSource) {
        setTab(firstSource);
      }

      return;
    }

    setPending(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    try {
      const body = buildCapturePutBody(fields, values);
      const result = await saveProjectAssetCapture(projectId, assetId, body);
      const nextFields = withMaintenanceCreateFields(result.capture.fields);
      const nextValues = initialCaptureValues(nextFields);
      nextValues.survey_record = emptySectionValues(
        fieldsForSource(nextFields, "survey_record"),
      );
      nextValues.maintenance_history = emptySectionValues(
        fieldsForSource(nextFields, "maintenance_history"),
      );

      setCapture(result.capture);
      setValues(nextValues);
      setSuccess(successMessage(result));
    } catch (caught) {
      const apiError = asApiError(caught);
      const mapped = mapApiFieldList(apiError);
      setError(apiError);
      setFieldErrors(mapped);

      const firstSource = firstErrorSource(
        mapped,
        tabs.map((item) => item.source),
      );

      if (firstSource) {
        setTab(firstSource);
      }
    } finally {
      setPending(false);
    }
  }

  if (fields.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-8">
        <Breadcrumbs
          current
          items={[
            { label: "Projects", href: "/projects" },
            { label: capture.project.title, href: projectHref },
            { label: capture.asset.tag },
          ]}
        />
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-gray-800">
            This project type has no capture fields configured.
          </p>
          <Link
            href={projectHref}
            className={`${secondaryButtonClassName} mt-5 inline-flex`}
          >
            Back to project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-28">
      <Breadcrumbs
        current
        items={[
          { label: "Projects", href: "/projects" },
          { label: capture.project.title, href: projectHref },
          { label: capture.asset.tag },
        ]}
      />

      <header className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
            <p className="mt-2 text-sm text-gray-500">
              {capture.project.title}
              {capture.project.projectReference
                ? ` · ${capture.project.projectReference}`
                : ""}
              {" · "}
              {capture.project.projectType.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Review</span>
              <ReviewStatusBadge status={capture.asset.reviewStatus} />
            </div>
            {isAssetLifecycleStatus(capture.asset.status) ? (
              <div className="grid gap-1">
                <span className="text-xs font-medium text-gray-500">Asset status</span>
                <span className="text-sm font-medium text-gray-800">
                  {assetStatusLabel(capture.asset.status)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <div className="mt-4 max-w-xs">
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="capture-review-status"
            >
              Review status
            </label>
            <select
              id="capture-review-status"
              value={capture.asset.reviewStatus}
              disabled={reviewPending || pending}
              className={inputClassName}
              onChange={(event) => {
                void setReviewStatus(event.target.value as ProjectAssetReviewStatus);
              }}
            >
              {PROJECT_ASSET_REVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {reviewStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      {success ? (
        <p
          className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-600"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <div>
        <div
          role="tablist"
          aria-label="Capture sections"
          className="flex flex-wrap gap-6 border-b border-gray-200"
        >
          {tabs.map((item) => {
            const selected = tab === item.source;
            const dirty =
              item.source !== "asset" &&
              isSectionDirty(fieldsForSource(fields, item.source), values[item.source]);

            return (
              <button
                key={item.source}
                type="button"
                role="tab"
                id={`${tablistId}-${item.source}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-${item.source}-panel`}
                onClick={() => {
                  setTab(item.source);
                }}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
                  selected
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {item.label}
                {dirty ? (
                  <span
                    className="ml-2 inline-block size-1.5 rounded-full bg-brand-500"
                    aria-label="Unsaved changes"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {tabs.map((item) => {
          if (item.source !== tab) {
            return null;
          }

          const sectionFields = fieldsForSource(fields, item.source).filter(
            (field) => field.key !== "referenceNumber",
          );

          return (
            <div
              key={item.source}
              role="tabpanel"
              id={`${tablistId}-${item.source}-panel`}
              aria-labelledby={`${tablistId}-${item.source}`}
              className="mt-6"
            >
              {item.source === "maintenance_history" ? (
                <p className="mb-5 text-sm text-gray-500">
                  Saving creates a new maintenance history entry. Maintenance type,
                  performed at, and work description are required.
                </p>
              ) : null}
              {item.source === "survey_record" ? (
                <p className="mb-5 text-sm text-gray-500">
                  Saving creates or updates the survey record for this asset on the
                  project.
                </p>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                {sectionFields.map((field) => (
                  <div
                    key={`${field.source}:${field.key}`}
                    className={wideField(field) ? "sm:col-span-2" : undefined}
                  >
                    <ProjectAssetCaptureField
                      field={field}
                      source={field.source}
                      value={values[field.source][field.key]}
                      disabled={!canEdit || pending}
                      messages={fieldErrors[fieldErrorKey(field.source, field.key)]}
                      assetId={capture.asset.id}
                      locationId={capture.asset.locationId}
                      onChange={(next) => {
                        setFieldValue(field.source, field.key, next);
                      }}
                    />
                  </div>
                ))}
              </div>
              {sectionFields.length === 0 ? (
                <p className="text-sm text-gray-500">No fields in this section.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {Object.keys(fieldErrors).length > 0 ? (
            <FieldMessages messages={["Fix the highlighted fields before saving."]} />
          ) : null}
          <Link href={projectHref} className={secondaryButtonClassName}>
            Cancel
          </Link>
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              className={primaryButtonClassName}
              onClick={() => {
                void save();
              }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function wideField(field: CaptureField): boolean {
  return (
    field.type === "text" &&
    (field.key === "workDescription" ||
      field.key === "observations" ||
      field.key === "comments" ||
      field.key === "findings" ||
      field.key === "actionsTaken" ||
      field.key === "notes" ||
      field.key === "description" ||
      field.key === "defectDetails" ||
      field.key === "componentDescription")
  );
}

function firstErrorSource(
  errors: Record<string, string[]>,
  order: CaptureSource[],
): CaptureSource | null {
  for (const source of order) {
    if (Object.keys(errors).some((key) => key.startsWith(`${source}.`))) {
      return source;
    }
  }

  return null;
}

function mapApiFieldList(error: ApiRequestError): Record<string, string[]> {
  const fromPaths = error.fieldErrors.fields
    ? mapApiFieldPaths(error.fieldErrors.fields)
    : {};
  const rest = { ...error.fieldErrors };
  delete rest.fields;

  const mappedRest: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(rest)) {
    const normalized = key
      .replace(/^surveyRecord\./, "survey_record.")
      .replace(/^maintenanceHistory\./, "maintenance_history.");
    mappedRest[normalized] = messages;
  }

  return { ...mappedRest, ...fromPaths };
}

function successMessage(result: {
  surveyRecordId: string | null;
  surveyRecordCreated: boolean;
  maintenanceHistoryId: string | null;
}): string {
  const parts = ["Saved."];

  if (result.maintenanceHistoryId) {
    parts.push("Maintenance history created.");
  }

  if (result.surveyRecordId) {
    parts.push(
      result.surveyRecordCreated ? "Survey record created." : "Survey record updated.",
    );
  }

  return parts.join(" ");
}

function isAssetLifecycleStatus(value: string): value is AssetStatus {
  return (ASSET_STATUSES as readonly string[]).includes(value);
}
