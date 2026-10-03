"use client";

import { useEffect, useState } from "react";

export type FieldErrors = Record<string, string[]>;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (
    init?.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(0, "The server could not be reached.");
  }

  const data: unknown = await response.json().catch(() => null);

  if (response.status === 401) {
    // The session cookie is gone, so the next page has to be a full load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/sign-in");
    throw new ApiRequestError(401, "Unauthorized");
  }

  if (!response.ok) {
    throw errorFromBody(response.status, data);
  }

  return data;
}

export function asApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  return new ApiRequestError(0, "The response could not be read.");
}

export function useApi<T>(path: string | null, parse: (data: unknown) => T) {
  const [state, setState] = useState<ApiState<T>>({
    path,
    data: null,
    error: null,
    loading: path !== null,
  });

  if (state.path !== path) {
    setState({ path, data: null, error: null, loading: path !== null });
  }

  useEffect(() => {
    if (!path) {
      return;
    }

    let cancelled = false;

    apiRequest(path)
      .then((body) => {
        if (!cancelled) {
          setState({ path, data: parse(body), error: null, loading: false });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setState({
            path,
            data: null,
            error: asApiError(caught),
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, parse]);

  return { data: state.data, error: state.error, loading: state.loading };
}

type ApiState<T> = {
  path: string | null;
  data: T | null;
  error: ApiRequestError | null;
  loading: boolean;
};

function errorFromBody(status: number, data: unknown): ApiRequestError {
  const error = readString(data, "error") ?? "Request failed.";
  const message =
    error === "Auth0 request failed."
      ? "Account changes are temporarily unavailable."
      : error;

  return new ApiRequestError(status, message, readFieldErrors(data));
}

function readFieldErrors(data: unknown): FieldErrors {
  if (!data || typeof data !== "object" || !("details" in data)) {
    return {};
  }

  const details = data.details;

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  return flattenFieldErrors(details);
}

function flattenFieldErrors(
  value: object,
  prefix = "",
): FieldErrors {
  const errors: FieldErrors = {};

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(child)) {
      const messages = child.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );

      if (messages.length > 0) {
        errors[path] = messages;
      }

      continue;
    }

    if (child && typeof child === "object") {
      Object.assign(errors, flattenFieldErrors(child, path));
    }
  }

  return errors;
}

function readString(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object" || !(key in data)) {
    return null;
  }

  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
