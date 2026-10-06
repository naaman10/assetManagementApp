import type { Metadata } from "next";
import { EditAssetType } from "@/components/asset-types/edit-asset-type";

export const metadata: Metadata = {
  title: "Edit asset type · Asset Management",
};

export default async function EditAssetTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditAssetType id={id} />;
}
