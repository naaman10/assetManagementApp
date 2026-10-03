import type { Metadata } from "next";
import { RoleList } from "@/components/roles/role-list";

export const metadata: Metadata = {
  title: "Roles · Asset Management",
};

export default function RolesPage() {
  return <RoleList />;
}
