"use client";

import { useState } from "react";
import { Forbidden } from "@/components/forbidden";
import { PageHeading } from "@/components/form-controls";
import { MaintenanceTypeForm } from "@/components/maintenance-types/maintenance-type-form";
import { useSession } from "@/components/session-provider";
import {
  MAINTENANCE_TYPES_CREATE,
  MAINTENANCE_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

export function CreateMaintenanceType() {
  const { user } = useSession();
  const [denied, setDenied] = useState<string | null>(null);
  const canView = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const canCreate = hasPermission(user, MAINTENANCE_TYPES_CREATE);

  if (!canView || !canCreate || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading title="New maintenance type" />
      <MaintenanceTypeForm
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
