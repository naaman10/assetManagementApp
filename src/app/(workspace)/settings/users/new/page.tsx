import type { Metadata } from "next";
import { CreateUser } from "@/components/users/create-user";

export const metadata: Metadata = {
  title: "Create user · Asset Management",
};

export default function NewUserPage() {
  return <CreateUser />;
}
