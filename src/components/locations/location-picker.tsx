"use client";

import { AssetTypePicker } from "@/components/assets/asset-type-picker";
import {
  filterParentCandidates,
  flattenLocationTree,
  locationLabel,
  locationPathLabel,
  locationTypeLabel,
  parentRequiresRoot,
  type Location,
  type LocationType,
} from "@/lib/locations";

export function LocationPicker({
  id,
  locations,
  value,
  onChange,
  disabled,
  loading,
  clearLabel,
  childType,
  excludeId,
  mode = "all",
  placeholder = "Choose a location",
  searchPlaceholder = "Search locations",
  listLabel = "Locations",
}: {
  id: string;
  locations: Location[];
  value: string;
  onChange: (locationId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  clearLabel?: string;
  /** When set with mode "parent", filters candidates by type rules for this child type. */
  childType?: LocationType | null;
  excludeId?: string;
  mode?: "all" | "parent";
  placeholder?: string;
  searchPlaceholder?: string;
  listLabel?: string;
}) {
  const options =
    mode === "parent"
      ? parentRequiresRoot(childType ?? null)
        ? []
        : filterParentCandidates(locations, {
            childType: childType ?? null,
            excludeId,
          })
      : locations.filter((location) => location.id !== excludeId);

  const rows =
    mode === "parent"
      ? options.map((location) => ({
          id: location.id,
          name: locationLabel(location),
          code: `${locationTypeLabel(location.locationType)}${
            location.locationCode ? ` · ${location.locationCode}` : ""
          }`,
        }))
      : flattenLocationTree(options).map((location) => ({
          id: location.id,
          name: `${"\u00A0".repeat(location.depth * 2)}${locationLabel(location)}`,
          code: locationPathLabel(locations, location.id),
        }));

  return (
    <AssetTypePicker
      id={id}
      types={rows}
      value={value}
      disabled={disabled || (mode === "parent" && parentRequiresRoot(childType ?? null))}
      loading={loading}
      listLabel={listLabel}
      placeholder={
        mode === "parent" && parentRequiresRoot(childType ?? null)
          ? "Site root (no parent)"
          : placeholder
      }
      searchPlaceholder={searchPlaceholder}
      loadingLabel="Loading locations…"
      clearLabel={clearLabel}
      onChange={onChange}
    />
  );
}
