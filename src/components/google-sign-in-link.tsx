"use client";

import { AUTH_RETURN_PATH_KEY, safeReturnPath } from "@/lib/return-path";

export function GoogleSignInLink({
  returnTo,
  children,
}: {
  returnTo: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="/api/auth/google"
      onClick={() => {
        try {
          sessionStorage.setItem(
            AUTH_RETURN_PATH_KEY,
            safeReturnPath(returnTo),
          );
        } catch {
          // Sign-in still continues if storage is unavailable.
        }
      }}
      className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-accent text-sm font-medium text-accent-foreground"
    >
      {children}
    </a>
  );
}
