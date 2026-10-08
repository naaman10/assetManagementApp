import type { Metadata } from "next";
import { MaintenanceTypeList } from "@/components/maintenance-types/maintenance-type-list";

export const metadata: Metadata = {
  title: "Maintenance types · Asset Management",
};

export default function MaintenanceTypesPage() {
  return <MaintenanceTypeList />;
}
