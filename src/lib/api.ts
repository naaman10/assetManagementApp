import "server-only";

/**
 * Server-side client for the Render API.
 * Browser code should call same-origin `/api/*`. Next.js proxies those
 * requests to API_URL, so the API address stays off the client.
 */
export function getApiUrl(): string {
  const url = process.env.API_URL?.trim().replace(/\/$/, "");

  if (!url) {
    throw new Error(
      "API_URL is not set. Add the Render API base URL to the server environment.",
    );
  }

  return url;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(`${getApiUrl()}${normalizedPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
