import Link from "next/link";
import { DataTable } from "@/components/form-controls";
import {
  locationCompactLabel,
  type Location,
} from "@/lib/locations";
import {
  type Asset,
  type AssetLocation,
  type AssetStatus,
} from "@/lib/sites";

const statusLabels: Record<AssetStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  out_of_service: "Out of Service",
  decommissioned: "Decommissioned",
  disposed: "Disposed",
  proposed: "Proposed",
  under_installation: "Under Installation",
  awaiting_commissioning: "Awaiting Commissioning",
  deleted: "Deleted",
};

export function assetStatusLabel(status: AssetStatus): string {
  return statusLabels[status];
}

export function formatQuantity(asset: Asset): string {
  if (asset.quantity == null) {
    return "—";
  }

  return asset.unitOfMeasure
    ? `${asset.quantity} ${asset.unitOfMeasure}`
    : String(asset.quantity);
}

export function AssetTable({
  assets,
  includeLocation = false,
  locations,
}: {
  assets: Asset[];
  includeLocation?: boolean;
  /** When provided, Location column shows leaf · parent instead of a flat name. */
  locations?: Location[];
}) {
  if (assets.length === 0) {
    return <p className="text-sm text-gray-500">No assets yet.</p>;
  }

  const columns = includeLocation
    ? ["Location", "Tag", "Name", "Type", "Quantity", "Status"]
    : ["Tag", "Name", "Type", "Quantity", "Status"];

  return (
    <DataTable columns={columns}>
      {assets.map((asset) => (
        <tr key={asset.id} className="hover:bg-gray-50">
          {includeLocation ? (
            <td className="px-5 py-4">
              <Link
                href={`/locations/${asset.location.id}`}
                className="text-sm font-medium text-gray-800"
              >
                {locations
                  ? locationCompactLabel(locations, asset.location.id, asset.location)
                  : flatLocationLabel(asset.location)}
              </Link>
            </td>
          ) : null}
          <td className="px-5 py-4 text-sm text-gray-500">
            {asset.assetName ? (
              asset.tag
            ) : (
              <Link href={`/assets/${asset.id}`} className="font-medium text-gray-800">
                {asset.tag}
              </Link>
            )}
          </td>
          <td className="px-5 py-4 text-sm font-medium text-gray-800">
            {asset.assetName ? (
              <Link href={`/assets/${asset.id}`}>{asset.assetName}</Link>
            ) : (
              "—"
            )}
          </td>
          <td className="px-5 py-4 text-sm text-gray-500">{asset.assetType.name}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{formatQuantity(asset)}</td>
          <td className="px-5 py-4 text-sm text-gray-500">{assetStatusLabel(asset.status)}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function flatLocationLabel(location: AssetLocation): string {
  return location.name ?? location.locationCode ?? "—";
}
