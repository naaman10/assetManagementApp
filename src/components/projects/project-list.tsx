"use client";

import Link from "next/link";
import { ProjectTable } from "@/components/projects/project-table";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseProjectList } from "@/lib/projects";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function ProjectList() {
  const { user } = useSession();
  const canCreate = hasPermission(user, CLIENTS_VIEW);
  const request = useApi("/api/projects", parseProjectList);
  const projects = request.data?.projects;

  return (
    <section>
      <PageHeading
        title="Projects"
        action={
          canCreate ? (
            <Link href="/projects/new" className={primaryButtonClassName}>
              New project
            </Link>
          ) : null
        }
      />
      {request.loading ? <p className="mt-6 text-sm text-gray-500">Loading projects…</p> : null}
      {request.error ? (
        <p className="mt-6 text-sm text-error-600" role="alert">
          {asApiError(request.error).message}
        </p>
      ) : null}
      {projects && !request.error ? (
        projects.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">No projects yet.</p>
        ) : (
          <ProjectTable projects={projects} includeClient />
        )
      ) : null}
    </section>
  );
}
