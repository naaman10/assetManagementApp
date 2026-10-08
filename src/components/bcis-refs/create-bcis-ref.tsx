"use client";

import { useState } from "react";
import { BcisRefForm } from "@/components/bcis-refs/bcis-ref-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { BCIS_REFS_CREATE, hasPermission } from "@/lib/session";

export function CreateBcisRef() {
  const { user } = useSession();
  const [denied, setDenied] = useState<string | null>(null);
  const canCreate = hasPermission(user, BCIS_REFS_CREATE);

  if (!canCreate || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading title="New BCIS reference" />
      <BcisRefForm
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
