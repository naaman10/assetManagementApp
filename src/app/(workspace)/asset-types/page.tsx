import type { Metadata } from "next";
import { AssetTypeList } from "@/components/asset-types/asset-type-list";

export const metadata: Metadata = {
  title: "Asset types · Asset Management",
};

export default function AssetTypesPage() {
  return <AssetTypeList />;
}
