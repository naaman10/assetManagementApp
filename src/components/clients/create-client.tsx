"use client";

import { ClientForm } from "@/components/clients/client-form";
import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { CLIENTS_CREATE, hasPermission } from "@/lib/session";

export function CreateClient() {
  const { user } = useSession();

  if (!hasPermission(user, CLIENTS_CREATE)) {
    return <Forbidden />;
  }

  return <ClientForm />;
}
