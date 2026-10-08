import type { Metadata } from "next";
import { CreateMaintenanceType } from "@/components/maintenance-types/create-maintenance-type";

export const metadata: Metadata = {
  title: "New maintenance type · Asset Management",
};

export default function NewMaintenanceTypePage() {
  return <CreateMaintenanceType />;
}
