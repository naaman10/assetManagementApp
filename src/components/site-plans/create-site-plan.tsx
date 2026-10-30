"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import { locationLabel, parseLocationList } from "@/lib/locations";
import { parseClientChoices, parseClientSites } from "@/lib/projects";
import { parseSitePlanBody, planFileProblem } from "@/lib/site-plans";
import { CLIENTS_EDIT, hasPermission } from "@/lib/session";

export function CreateSitePlan() {
  const router = useRouter();
  const { user } = useSession();
  const canCreate = hasPermission(user, CLIENTS_EDIT);
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  const clientsRequest = useApi(canCreate ? "/api/clients" : null, parseClientChoices);
  const sitesRequest = useApi(
    canCreate && clientId ? `/api/clients/${clientId}` : null,
    parseClientSites,
  );
  const floorsRequest = useApi(
    canCreate && siteId
      ? `/api/sites/${siteId}/locations?locationType=floor`
      : null,
    parseLocationList,
  );

  const clients = clientsRequest.data ?? [];
  const sites = sitesRequest.data?.sites ?? [];
  const floors = (floorsRequest.data?.locations ?? []).filter(
    (location) => location.locationType === "floor",
  );

  if (!canCreate) {
    return <Forbidden />;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientId) {
      setError(new ApiRequestError(400, "Invalid request", {
        clientId: ["Choose a client."],
      }));
      return;
    }

    if (!siteId) {
      setError(new ApiRequestError(400, "Invalid request", {
        siteId: ["Choose a site."],
      }));
      return;
    }

    if (!locationId) {
      setError(new ApiRequestError(400, "Invalid request", {
        locationId: ["Choose a floor."],
      }));
      return;
    }

    if (!name.trim()) {
      setError(new ApiRequestError(400, "Invalid request", {
        name: ["Enter a name."],
      }));
      return;
    }

    if (!file) {
      setError(new ApiRequestError(400, "Invalid request", {
        plan: ["Choose a plan file."],
      }));
      return;
    }

    const problem = planFileProblem(file);

    if (problem) {
      setError(new ApiRequestError(400, "Invalid request", { plan: [problem] }));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body = new FormData();
      body.set("locationId", locationId);
      body.set("name", name.trim());
      body.set("plan", file);
      const plan = parseSitePlanBody(
        await apiRequest("/api/site-plans", {
          method: "POST",
          body,
        }),
      );
      router.push(`/site-plans/${plan.id}`);
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 409) {
        setError(
          new ApiRequestError(409, "This floor already has a site plan.", apiError.fieldErrors),
        );
      } else {
        setError(apiError);
      }

      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-800">New site plan</h1>
      <p className="mt-2 text-sm text-gray-500">
        Choose a floor, name the plan, and upload a PDF or image.
      </p>
      <form className="mt-8 grid gap-5" onSubmit={onSubmit}>
        <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="site-plan-client">
            Client
          </label>
          <select
            id="site-plan-client"
            value={clientId}
            disabled={pending || clientsRequest.loading}
            onChange={(event) => {
              setClientId(event.target.value);
              setSiteId("");
              setLocationId("");
            }}
            className={inputClassName}
          >
            <option value="">
              {clientsRequest.loading ? "Loading clients…" : "Choose a client"}
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <FieldMessages messages={fieldErrors.clientId} />
          {clientsRequest.error ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {clientsRequest.error.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="site-plan-site">
            Site
          </label>
          <select
            id="site-plan-site"
            value={siteId}
            disabled={pending || !clientId || sitesRequest.loading}
            onChange={(event) => {
              setSiteId(event.target.value);
              setLocationId("");
            }}
            className={inputClassName}
          >
            <option value="">
              {!clientId
                ? "Choose a client first"
                : sitesRequest.loading
                  ? "Loading sites…"
                  : "Choose a site"}
            </option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <FieldMessages messages={fieldErrors.siteId} />
          {sitesRequest.error ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {sitesRequest.error.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="site-plan-floor">
            Floor
          </label>
          <select
            id="site-plan-floor"
            value={locationId}
            disabled={pending || !siteId || floorsRequest.loading}
            onChange={(event) => {
              setLocationId(event.target.value);
            }}
            className={inputClassName}
          >
            <option value="">
              {!siteId
                ? "Choose a site first"
                : floorsRequest.loading
                  ? "Loading floors…"
                  : floors.length === 0
                    ? "No floors on this site"
                    : "Choose a floor"}
            </option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {locationLabel(floor)}
              </option>
            ))}
          </select>
          <FieldMessages messages={fieldErrors.locationId} />
          {floorsRequest.error ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {floorsRequest.error.message}
            </p>
          ) : null}
        </div>

        <TextField
          id="site-plan-name"
          label="Name"
          required
          maxLength={255}
          value={name}
          disabled={pending}
          messages={fieldErrors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="site-plan-file">
            Plan file
          </label>
          <input
            id="site-plan-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
            }}
            className="mt-1.5 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100"
          />
          <p className="mt-1.5 text-xs text-gray-500">PDF, JPEG, PNG, or WebP · max 25 MB</p>
          <FieldMessages messages={fieldErrors.plan} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClassName}>
            {pending ? "Creating…" : "Create site plan"}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={pending}
            onClick={() => {
              router.push("/site-plans");
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
