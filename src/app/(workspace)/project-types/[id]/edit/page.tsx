import type { Metadata } from "next";
import { EditProjectType } from "@/components/project-types/edit-project-type";

export const metadata: Metadata = {
  title: "Edit project type · Asset Management",
};

export default async function EditProjectTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditProjectType id={id} />;
}
