import type { Metadata } from "next";
import { EditSite } from "@/components/sites/edit-site";

export const metadata: Metadata = {
  title: "Edit site · Asset Management",
};

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditSite id={id} />;
}
