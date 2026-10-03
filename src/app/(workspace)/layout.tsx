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
        <main className="px-8 pb-16 sm:px-12">{children}</main>
      </div>
    </SessionProvider>
  );
}
