"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { ProjectTypeForm } from "@/components/project-types/project-type-form";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseProjectTypeBody } from "@/lib/project-types";
import { PROJECT_TYPES_EDIT, PROJECT_TYPES_VIEW, hasPermission } from "@/lib/session";

export function EditProjectType({ id }: { id: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canView = hasPermission(user, PROJECT_TYPES_VIEW);
  const canEdit = hasPermission(user, PROJECT_TYPES_EDIT);
  const allowed = canView && canEdit;
  const request = useApi(allowed ? `/api/project-types/${id}` : null, parseProjectTypeBody);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/project-types");
    }
  }, [missing, router]);

  if (!canView || !canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading project type…</p>;
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

  const projectType = request.data;

  if (!projectType) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit project type"
        action={
          <Link href={`/project-types/${projectType.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <ProjectTypeForm
        key={projectType.id}
        projectType={projectType}
        onMissing={() => {
          router.replace("/project-types");
        }}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
