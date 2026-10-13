"use client";

import { useState } from "react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  DataTable,
  PageHeading,
  TextField,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseProjectTypeList, type ProjectType } from "@/lib/project-types";
import {
  PROJECT_TYPES_CREATE,
  PROJECT_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

export function ProjectTypeList() {
  const { user } = useSession();
  const canView = hasPermission(user, PROJECT_TYPES_VIEW);
  const canCreate = hasPermission(user, PROJECT_TYPES_CREATE);
  const { data, error, loading } = useApi(
    canView ? "/api/project-types" : null,
    parseProjectTypeList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="Project types"
        action={
          canCreate ? (
            <Link href="/project-types/new" className={primaryButtonClassName}>
              New project type
            </Link>
          ) : null
        }
      />
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading project types…</p>
      ) : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(error).message}
          </p>
        )
      ) : null}
      {data ? <ProjectTypeRows projectTypes={data} /> : null}
    </section>
  );
}

function ProjectTypeRows({ projectTypes }: { projectTypes: ProjectType[] }) {
  const [query, setQuery] = useState("");

  if (projectTypes.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No project types yet.</p>;
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? projectTypes.filter(
        (projectType) =>
          projectType.code.toLowerCase().includes(needle) ||
          projectType.name.toLowerCase().includes(needle),
      )
    : projectTypes;

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="project-type-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No project types match.</p>
      ) : (
        <DataTable columns={["Sort order", "Code", "Name", "Status"]}>
          {rows.map((projectType) => (
            <tr key={projectType.id} className="hover:bg-gray-50">
              <td className="px-5 py-4 text-sm text-gray-500">{projectType.sortOrder}</td>
              <td className="px-5 py-4 text-sm text-gray-500">{projectType.code}</td>
              <td className="px-5 py-4">
                <Link
                  href={`/project-types/${projectType.id}`}
                  className="text-sm font-medium text-gray-800"
                >
                  {projectType.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <Badge tone={projectType.isActive ? "success" : "light"}>
                  {projectType.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
