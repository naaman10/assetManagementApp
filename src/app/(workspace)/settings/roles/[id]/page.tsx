import type { Metadata } from "next";
import { RoleEditor } from "@/components/roles/role-editor";

export const metadata: Metadata = {
  title: "Role · Asset Management",
};

export default async function RolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoleEditor id={id} />;
}