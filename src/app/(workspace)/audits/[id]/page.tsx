import type { Metadata } from "next";
import { AuditDetail } from "@/components/audits/audit-detail";

export const metadata: Metadata = {
  title: "Audit · Asset Management",
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditDetail id={id} />;
}
