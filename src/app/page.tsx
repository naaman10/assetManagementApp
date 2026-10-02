import { cookies } from "next/headers";
import { Logo } from "@/components/logo";
import { ResumeReturnPath } from "@/components/resume-return-path";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.toString());
  const label = session?.user.name || session?.user.email;

  return (
    <main className="flex min-h-dvh flex-col px-8 py-10 sm:px-12">
      <ResumeReturnPath />
      <header className="flex items-center justify-between gap-6">
        <Logo />
        <SignOutButton />
      </header>
      {label ? (
        <h1 className="mt-16 text-4xl font-medium tracking-tight">{label}</h1>
      ) : null}
    </main>
  );
}
