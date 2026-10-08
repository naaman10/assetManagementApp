import type { Metadata } from "next";
import { EditBcisSubRef } from "@/components/bcis-sub-refs/edit-bcis-sub-ref";

export const metadata: Metadata = {
  title: "Edit BCIS sub reference · Asset Management",
};

export default async function EditBcisSubRefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditBcisSubRef id={id} />;
}
