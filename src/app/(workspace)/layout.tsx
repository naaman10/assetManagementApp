import { cookies } from "next/headers";
import { AppHeader } from "@/components/app-header";
import { SessionProvider } from "@/components/session-provider";
import { getSession } from "@/lib/auth";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.toString());

  if (!session) {
    return children;
  }

  return (
    <SessionProvider user={session.user}>
      <div className="min-h-dvh">
        <AppHeader />
        <main className="min-h-dvh ml-[17rem] px-5 pt-20 pb-8 sm:px-12 sm:pb-10">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
