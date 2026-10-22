import type { Metadata } from "next";
import { Nrm3ClassificationDetail } from "@/components/nrm3-classifications/nrm3-classification-detail";

export const metadata: Metadata = {
  title: "NRM3 classification · Asset Management",
};

export default async function Nrm3ClassificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <Nrm3ClassificationDetail code={decodeURIComponent(code)} />;
}
