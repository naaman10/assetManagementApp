import type { Metadata } from "next";
import { AssetDetail } from "@/components/assets/asset-detail";

export const metadata: Metadata = {
  title: "Asset · Asset Management",
};

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetDetail id={id} />;
}
