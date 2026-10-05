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
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-8">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold text-gray-800">Sign in</h1>
        <p className="mt-2 text-sm text-gray-500">
          Use the account your organisation gave you.
        </p>
        <SignInForm returnTo={returnTo} />
      </section>
    </div>
  );
}
