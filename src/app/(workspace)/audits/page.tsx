import type { Metadata } from "next";
import { AuditList } from "@/components/audits/audit-list";

export const metadata: Metadata = {
  title: "Audits · Asset Management",
};

export default function AuditsPage() {
  return <AuditList />;
}
