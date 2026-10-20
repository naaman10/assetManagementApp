import Link from "next/link";
import { DataTable } from "@/components/form-controls";
import {
  formatProjectDate,
  leadLabel,
  projectStatusLabel,
  type Project,
} from "@/lib/projects";

export function ProjectTable({
  projects,
  includeClient,
}: {
  projects: Project[];
  includeClient: boolean;
}) {
  const columns = includeClient
    ? ["Title", "Client", "Type", "Project reference", "Status", "Lead", "Due date"]
    : ["Title", "Type", "Project reference", "Status", "Lead", "Due date"];

  return (
    <DataTable columns={columns}>
      {projects.map((project) => (
        <tr key={project.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link href={`/projects/${project.id}`} className="text-sm font-medium text-gray-800">
              {project.title}
            </Link>
          </td>
          {includeClient ? (
            <td className="px-5 py-4">
              <Link
                href={`/clients/${project.client.id}`}
                className="text-sm font-medium text-gray-800"
              >
                {project.client.name}
              </Link>
            </td>
          ) : null}
          <td className="px-5 py-4 text-sm text-gray-500">{project.projectType.name}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{project.projectReference}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{projectStatusLabel(project.status)}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{leadLabel(project.lead)}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{formatProjectDate(project.dueDate)}</td>
        </tr>
      ))}
    </DataTable>
  );
}
