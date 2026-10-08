import type { Metadata } from "next";
import { EditBcisRef } from "@/components/bcis-refs/edit-bcis-ref";

export const metadata: Metadata = {
  title: "Edit BCIS reference · Asset Management",
};

export default async function EditBcisRefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditBcisRef id={id} />;
}
