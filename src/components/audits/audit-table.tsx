import Link from "next/link";
import { DataTable } from "@/components/form-controls";
import {
  auditStatusLabel,
  formatAuditDate,
  leadLabel,
  type Audit,
} from "@/lib/audits";

export function AuditTable({
  audits,
  includeClient,
}: {
  audits: Audit[];
  includeClient: boolean;
}) {
  const columns = includeClient
    ? ["Title", "Client", "Project reference", "Status", "Lead", "Due date"]
    : ["Title", "Project reference", "Status", "Lead", "Due date"];

  return (
    <DataTable columns={columns}>
      {audits.map((audit) => (
        <tr key={audit.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link href={`/audits/${audit.id}`} className="text-sm font-medium text-gray-800">
              {audit.title}
            </Link>
          </td>
          {includeClient ? (
            <td className="px-5 py-4">
              <Link
                href={`/clients/${audit.client.id}`}
                className="text-sm font-medium text-gray-800"
              >
                {audit.client.name}
              </Link>
            </td>
          ) : null}
          <td className="px-5 py-4 text-sm text-gray-500">{audit.projectReference}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{auditStatusLabel(audit.status)}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{leadLabel(audit.lead)}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{formatAuditDate(audit.dueDate)}</td>
        </tr>
      ))}
    </DataTable>
  );
}
