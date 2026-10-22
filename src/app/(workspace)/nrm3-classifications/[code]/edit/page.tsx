import type { Metadata } from "next";
import { EditNrm3Classification } from "@/components/nrm3-classifications/edit-nrm3-classification";

export const metadata: Metadata = {
  title: "Edit NRM3 classification · Asset Management",
};

export default async function EditNrm3ClassificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <EditNrm3Classification code={decodeURIComponent(code)} />;
}
