import type { Metadata } from "next";
import { CreateProject } from "@/components/projects/create-project";

export const metadata: Metadata = {
  title: "New project · Asset Management",
};

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  return <CreateProject clientId={params.client} />;
}
