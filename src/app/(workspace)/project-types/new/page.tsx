import type { Metadata } from "next";
import { CreateProjectType } from "@/components/project-types/create-project-type";

export const metadata: Metadata = {
  title: "New project type · Asset Management",
};

export default function NewProjectTypePage() {
  return <CreateProjectType />;
}
