import type { Metadata } from "next";
import { UserList } from "@/components/users/user-list";

export const metadata: Metadata = {
  title: "Users · Asset Management",
};

export default function UsersPage() {
  return <UserList />;
}
