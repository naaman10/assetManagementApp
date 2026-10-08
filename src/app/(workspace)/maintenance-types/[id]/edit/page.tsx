import type { Metadata } from "next";
import { EditMaintenanceType } from "@/components/maintenance-types/edit-maintenance-type";

export const metadata: Metadata = {
  title: "Edit maintenance type · Asset Management",
};

export default async function EditMaintenanceTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditMaintenanceType id={id} />;
}
