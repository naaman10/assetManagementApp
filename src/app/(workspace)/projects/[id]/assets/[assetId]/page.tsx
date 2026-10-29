import type { Metadata } from "next";
import { ProjectAssetCapturePage } from "@/components/projects/project-asset-capture";

export const metadata: Metadata = {
  title: "Capture · Asset Management",
};

export default async function ProjectAssetCaptureRoute({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  const { id, assetId } = await params;
  return <ProjectAssetCapturePage projectId={id} assetId={assetId} />;
}
