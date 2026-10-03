import type { Metadata } from "next";
import { UserEditor } from "@/components/users/user-editor";

export const metadata: Metadata = {
  title: "User · Asset Management",
};

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserEditor id={id} />;
}
