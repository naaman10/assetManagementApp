"use client";

import { useState } from "react";
import { inputClassName, primaryButtonClassName } from "@/components/form-controls";
import { safeReturnPath } from "@/lib/return-path";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const password = form.get("password");

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: typeof email === "string" ? email : "",
          password: typeof password === "string" ? password : "",
        }),
      });

      if (response.ok) {
        window.location.assign(safeReturnPath(returnTo));
        return;
      }

      setError(await signInError(response));
    } catch {
      setError("Sign-in is unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="mt-6 grid gap-5">
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={pending}
          className={inputClassName}
        />
      </div>
      {error ? (
        <p
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClassName} w-full`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

async function signInError(response: Response): Promise<string> {
  if (response.status === 401) {
    return (await readError(response)) ?? "Invalid email or password.";
  }

  if (response.status === 400) {
    return "Enter a valid email and password.";
  }

  return "Sign-in is unavailable.";
}

async function readError(response: Response): Promise<string | null> {
  const data: unknown = await response.json().catch(() => null);

  if (!data || typeof data !== "object" || !("error" in data)) {
    return null;
  }

  return typeof data.error === "string" && data.error.length > 0
    ? data.error
    : null;
}
