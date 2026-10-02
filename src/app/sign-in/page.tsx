import type { Metadata } from "next";
import { GoogleSignInLink } from "@/components/google-sign-in-link";
import { Logo } from "@/components/logo";
import { safeReturnPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · Asset Management",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    return_to?: string | string[];
    auth_error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const requested =
    typeof params.return_to === "string" ? params.return_to : null;
  const returnTo = safeReturnPath(requested);
  const authError =
    typeof params.auth_error === "string"
      ? authErrorMessage(params.auth_error)
      : null;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <section className="flex flex-1 flex-col gap-12 px-8 py-10 sm:px-12 lg:justify-center lg:gap-16 lg:px-20">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl font-medium tracking-tight">
            Asset Management
          </h1>
          <p className="mt-4 text-lg leading-7 text-muted">
            A workspace for the equipment and property your organisation looks
            after. Sign in to see what you own, who holds it, and where it is.
          </p>
        </div>
      </section>
      <section className="flex flex-1 items-center bg-surface px-8 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-3xl font-medium tracking-tight">Sign in</h2>
          <p className="mt-3 text-[15px] leading-6 text-muted">
            Continue with the Google account your organisation uses.
          </p>
          {authError ? (
            <p className="mt-4 text-sm leading-6 text-ink" role="alert">
              {authError}
            </p>
          ) : null}
          <GoogleSignInLink returnTo={returnTo}>
            <GoogleMark />
            Continue with Google
          </GoogleSignInLink>
        </div>
      </section>
    </div>
  );
}

function authErrorMessage(code: string): string | null {
  switch (code) {
    case "access_denied":
      return "Google sign-in was cancelled or this account is not allowed to use the app.";
    case "invalid_state":
      return "Sign-in expired. Try again from this page.";
    case "auth_failed":
      return "Google sign-in could not be completed.";
    default:
      return null;
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
