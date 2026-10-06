import type { Metadata } from "next";
import { CreateAudit } from "@/components/audits/create-audit";

export const metadata: Metadata = {
  title: "New audit · Asset Management",
};

export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  return <CreateAudit clientId={params.client} />;
}
