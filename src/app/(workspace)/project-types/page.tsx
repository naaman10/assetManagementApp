import type { Metadata } from "next";
import { ProjectTypeList } from "@/components/project-types/project-type-list";

export const metadata: Metadata = {
  title: "Project types · Asset Management",
};

export default function ProjectTypesPage() {
  return <ProjectTypeList />;
}
