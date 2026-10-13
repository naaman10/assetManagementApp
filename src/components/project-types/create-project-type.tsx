"use client";

import { useState } from "react";
import { Forbidden } from "@/components/forbidden";
import { PageHeading } from "@/components/form-controls";
import { ProjectTypeForm } from "@/components/project-types/project-type-form";
import { useSession } from "@/components/session-provider";
import { PROJECT_TYPES_CREATE, PROJECT_TYPES_VIEW, hasPermission } from "@/lib/session";

export function CreateProjectType() {
  const { user } = useSession();
  const [denied, setDenied] = useState<string | null>(null);
  const canView = hasPermission(user, PROJECT_TYPES_VIEW);
  const canCreate = hasPermission(user, PROJECT_TYPES_CREATE);

  if (!canView || !canCreate || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading title="New project type" />
      <ProjectTypeForm
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
