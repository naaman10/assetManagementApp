"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { MaintenanceTypeForm } from "@/components/maintenance-types/maintenance-type-form";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseMaintenanceTypeBody } from "@/lib/maintenance-types";
import {
  MAINTENANCE_TYPES_EDIT,
  MAINTENANCE_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

export function EditMaintenanceType({ id }: { id: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canView = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const canEdit = hasPermission(user, MAINTENANCE_TYPES_EDIT);
  const allowed = canView && canEdit;
  const request = useApi(
    allowed ? `/api/maintenance-types/${id}` : null,
    parseMaintenanceTypeBody,
  );
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/maintenance-types");
    }
  }, [missing, router]);

  if (!canView || !canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading maintenance type…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  const maintenanceType = request.data;

  if (!maintenanceType) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit maintenance type"
        action={
          <Link href={`/maintenance-types/${maintenanceType.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <MaintenanceTypeForm
        key={maintenanceType.id}
        maintenanceType={maintenanceType}
        onMissing={() => {
          router.replace("/maintenance-types");
        }}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
