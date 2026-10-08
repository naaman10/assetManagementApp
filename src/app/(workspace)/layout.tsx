import { cookies } from "next/headers";
import { AppHeader } from "@/components/app-header";
import { GlobalSearch } from "@/components/global-search";
import { MobileSearchProvider } from "@/components/mobile-search";
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
      <MobileSearchProvider>
        <div className="min-h-dvh">
          <AppHeader />
          <main className="min-h-dvh px-4 pt-20 pb-6 lg:ml-[290px] lg:px-6 lg:pt-6">
            <GlobalSearch />
            {children}
          </main>
        </div>
      </MobileSearchProvider>
    </SessionProvider>
  );
}
