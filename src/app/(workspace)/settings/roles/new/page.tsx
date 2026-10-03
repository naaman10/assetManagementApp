import type { Metadata } from "next";
import { CreateRole } from "@/components/roles/create-role";

export const metadata: Metadata = {
  title: "Create role · Asset Management",
};

export default function NewRolePage() {
  return <CreateRole />;
}
