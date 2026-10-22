"use client";

import { AssetTypePicker } from "@/components/assets/asset-type-picker";

type ParentCandidate = {
  id: string;
  tag: string;
  assetName: string | null;
};

export function ParentAssetPicker({
  id,
  assets,
  value,
  disabled,
  loading,
  startOpen = false,
  clearLabel,
  listLabel = "Assets",
  placeholder = "Choose a parent asset",
  searchPlaceholder = "Search assets",
  loadingLabel = "Loading assets…",
  onDismiss,
  onChange,
}: {
  id: string;
  assets: ParentCandidate[];
  value: string;
  disabled?: boolean;
  loading?: boolean;
  startOpen?: boolean;
  clearLabel?: string;
  listLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  loadingLabel?: string;
  onDismiss?: () => void;
  onChange: (assetId: string) => void;
}) {
  return (
    <AssetTypePicker
      id={id}
      types={assets.map((asset) => ({
        id: asset.id,
        name: asset.assetName ?? asset.tag,
        code: asset.tag,
      }))}
      value={value}
      disabled={disabled}
      loading={loading}
      startOpen={startOpen}
      listLabel={listLabel}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      loadingLabel={loadingLabel}
      clearLabel={clearLabel}
      onDismiss={onDismiss}
      onChange={onChange}
    />
  );
}
