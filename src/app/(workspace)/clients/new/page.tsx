import type { Metadata } from "next";
import { CreateClient } from "@/components/clients/create-client";

export const metadata: Metadata = {
  title: "Create client · Asset Management",
};

export default function NewClientPage() {
  return <CreateClient />;
}
