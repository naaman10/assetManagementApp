import type { Metadata } from "next";
import { AssetTypeDetail } from "@/components/asset-types/asset-type-detail";

export const metadata: Metadata = {
  title: "Asset type · Asset Management",
};

export default async function AssetTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetTypeDetail id={id} />;
}
