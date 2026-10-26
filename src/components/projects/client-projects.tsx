"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectTable } from "@/components/projects/project-table";
import { secondaryButtonClassName } from "@/components/form-controls";
import { asApiError, useApi } from "@/lib/api-client";
import { parseProjectList } from "@/lib/projects";

export function ClientProjects({ clientId }: { clientId: string }) {
  const router = useRouter();
  const request = useApi(`/api/clients/${clientId}/projects`, parseProjectList);
  const missing = request.error?.status === 404;
  const projects = request.data?.projects;

  useEffect(() => {
    if (missing) {
      router.replace("/clients");
    }
  }, [missing, router]);

  if (missing) {
    return null;
  }

  return (
    <section className="min-w-0">
      <div className="flex justify-end">
        <Link href={`/projects/new?client=${clientId}`} className={secondaryButtonClassName}>
          New project
        </Link>
      </div>
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
          <ProjectTable projects={projects} includeClient={false} />
        )
      ) : null}
    </section>
  );
}
