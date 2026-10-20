"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DataTable } from "@/components/form-controls";
import { asApiError, useApi } from "@/lib/api-client";
import {
  formatProjectDate,
  leadLabel,
  parseProjectBody,
  projectStatusLabel,
} from "@/lib/projects";

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const request = useApi(`/api/projects/${id}`, parseProjectBody);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/projects");
    }
  }, [missing, router]);

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading project…</p>;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  const project = request.data;

  if (!project) {
    return null;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <Breadcrumbs
          current
          items={[
            { label: "Projects", href: "/projects" },
            { label: project.client.name, href: `/clients/${project.client.id}` },
            { label: project.title },
          ]}
        />
        <p className="mt-6 text-sm text-gray-500">Project</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-800">{project.title}</h1>
        <Detail label="Project reference" value={project.projectReference} />
        <Detail label="Type" value={project.projectType.name} />
        <Detail label="Status" value={projectStatusLabel(project.status)} />
        <Detail label="Description" value={project.description ?? "—"} />
        <Detail label="Start date" value={formatProjectDate(project.startDate)} />
        <Detail label="Due date" value={formatProjectDate(project.dueDate)} />
        <Detail label="Lead" value={leadLabel(project.lead)} />
      </section>
      <section>
        {project.assets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets yet.</p>
        ) : (
          <DataTable columns={["Reference", "Name"]}>
            {project.assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500">{asset.assetRef}</td>
                <td className="px-5 py-4 text-sm font-medium text-gray-800">
                  {asset.assetName ?? "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <p className="mt-3 text-sm text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium whitespace-pre-line">{value}</p>
    </>
  );
}
