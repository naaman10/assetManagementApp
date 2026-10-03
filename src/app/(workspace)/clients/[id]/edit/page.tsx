import type { Metadata } from "next";
import { EditClient } from "@/components/clients/edit-client";

export const metadata: Metadata = {
  title: "Edit client · Asset Management",
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditClient id={id} />;
}
