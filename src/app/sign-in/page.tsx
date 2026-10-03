import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { SignInLink } from "@/components/sign-in-link";
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
            Joe's Asset Management
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
            Use the account your organisation gave you.
          </p>
          {authError ? (
            <p className="mt-4 text-sm leading-6 text-ink" role="alert">
              {authError}
            </p>
          ) : null}
          <SignInLink returnTo={returnTo}>Sign in</SignInLink>
        </div>
      </section>
    </div>
  );
}

function authErrorMessage(code: string): string | null {
  switch (code) {
    case "access_denied":
      return "Sign-in was cancelled or this account is not allowed to use the app.";
    case "invalid_state":
      return "Sign-in expired. Try again from this page.";
    case "auth_failed":
      return "Sign-in could not be completed.";
    default:
      return null;
  }
}

