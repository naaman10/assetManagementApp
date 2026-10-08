import type { Metadata } from "next";
import { CreateBcisRef } from "@/components/bcis-refs/create-bcis-ref";

export const metadata: Metadata = {
  title: "New BCIS reference · Asset Management",
};

export default function NewBcisRefPage() {
  return <CreateBcisRef />;
}
