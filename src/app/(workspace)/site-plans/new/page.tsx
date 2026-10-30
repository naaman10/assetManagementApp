import type { Metadata } from "next";
import { CreateSitePlan } from "@/components/site-plans/create-site-plan";

export const metadata: Metadata = {
  title: "New site plan · Asset Management",
};

export default function NewSitePlanPage() {
  return <CreateSitePlan />;
}
