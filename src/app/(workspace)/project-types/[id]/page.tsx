import type { Metadata } from "next";
import { ProjectTypeDetail } from "@/components/project-types/project-type-detail";

export const metadata: Metadata = {
  title: "Project type · Asset Management",
};

export default async function ProjectTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectTypeDetail id={id} />;
}
