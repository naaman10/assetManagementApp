import Link from "next/link";
import { DataTable } from "@/components/form-controls";
import {
  formatSitePlanDate,
  locationDisplayName,
  type SitePlanListItem,
} from "@/lib/site-plans";

export function SitePlanTable({ sitePlans }: { sitePlans: SitePlanListItem[] }) {
  return (
    <DataTable columns={["Name", "Client", "Site", "Floor", "Updated"]}>
      {sitePlans.map((plan) => (
        <tr key={plan.id} className="hover:bg-gray-50">
          <td className="px-5 py-4">
            <Link
              href={`/site-plans/${plan.id}`}
              className="text-sm font-medium text-gray-800"
            >
              {plan.name}
            </Link>
          </td>
          <td className="px-5 py-4">
            <Link
              href={`/clients/${plan.client.id}`}
              className="text-sm font-medium text-gray-800"
            >
              {plan.client.name}
            </Link>
          </td>
          <td className="px-5 py-4">
            <Link
              href={`/sites/${plan.site.id}`}
              className="text-sm font-medium text-gray-800"
            >
              {plan.site.name}
            </Link>
          </td>
          <td className="px-5 py-4">
            <Link
              href={`/locations/${plan.location.id}`}
              className="text-sm text-gray-500"
            >
              {locationDisplayName(plan.location)}
            </Link>
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">
            {formatSitePlanDate(plan.updatedAt)}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
