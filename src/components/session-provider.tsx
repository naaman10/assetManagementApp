"use client";

import { createContext, useContext, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { parseSession, type SessionUser } from "@/lib/session";

const SessionContext = createContext<{
  user: SessionUser;
  refresh: () => Promise<void>;
} | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState(user);

  async function refresh() {
    const session = parseSession(await apiRequest("/api/auth/me"));

    if (session) {
      setCurrent(session.user);
    }
  }

  return (
    <SessionContext.Provider value={{ user: current, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("SessionProvider is missing.");
  }

  return session;
}
