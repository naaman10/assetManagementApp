import type { Metadata } from "next";
import { ClientEditor } from "@/components/clients/client-editor";

export const metadata: Metadata = {
  title: "Client · Asset Management",
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientEditor id={id} />;
}
