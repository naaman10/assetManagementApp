import type { Metadata } from "next";
import { MaintenanceTypeDetail } from "@/components/maintenance-types/maintenance-type-detail";

export const metadata: Metadata = {
  title: "Maintenance type · Asset Management",
};

export default async function MaintenanceTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MaintenanceTypeDetail id={id} />;
}
