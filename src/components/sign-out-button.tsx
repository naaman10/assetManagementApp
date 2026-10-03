"use client";

export function SignOutButton() {
  async function signOut() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const logoutUrl = readLogoutUrl(await response.json().catch(() => null));

    if (logoutUrl) {
      window.location.assign(logoutUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
      }}
      className="flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
    >
      Sign out
    </button>
  );
}

function readLogoutUrl(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("logoutUrl" in data)) {
    return null;
  }

  const logoutUrl = data.logoutUrl;

  if (typeof logoutUrl !== "string") {
    return null;
  }

  try {
    const url = new URL(logoutUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
