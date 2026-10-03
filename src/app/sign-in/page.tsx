import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/sign-in-form";
import { safeReturnPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · Asset Management",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    return_to?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const requested =
    typeof params.return_to === "string" ? params.return_to : null;
  const returnTo = safeReturnPath(requested);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <section className="flex flex-1 flex-col gap-12 px-8 py-10 sm:px-12 lg:justify-center lg:gap-16 lg:px-20">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl font-medium tracking-tight">
            Joe&apos;s Asset Management
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
          <SignInForm returnTo={returnTo} />
        </div>
      </section>
    </div>
  );
}
