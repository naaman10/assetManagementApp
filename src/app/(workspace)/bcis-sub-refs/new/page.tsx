import type { Metadata } from "next";
import { CreateBcisSubRef } from "@/components/bcis-sub-refs/create-bcis-sub-ref";

export const metadata: Metadata = {
  title: "New BCIS sub reference · Asset Management",
};

export default function NewBcisSubRefPage() {
  return <CreateBcisSubRef />;
}
