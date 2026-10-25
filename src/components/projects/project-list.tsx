"use client";

import { useState } from "react";
import { CreateProject } from "@/components/projects/create-project";
import { ProjectTable } from "@/components/projects/project-table";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { Modal } from "@/components/modal";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseProjectList } from "@/lib/projects";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function ProjectList() {
  const { user } = useSession();
  const canCreate = hasPermission(user, CLIENTS_VIEW);
  const request = useApi("/api/projects", parseProjectList);
  const [creating, setCreating] = useState(false);
  const projects = request.data?.projects;

  return (
    <section>
      <PageHeading
        title="Projects"
        action={
          canCreate ? (
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setCreating(true);
              }}
            >
              New project
            </button>
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
      {creating ? (
        <Modal
          title="New project"
          size="lg"
          onClose={() => {
            setCreating(false);
          }}
        >
          <CreateProject
            embedded
            onCancel={() => {
              setCreating(false);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
