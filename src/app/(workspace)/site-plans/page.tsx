import type { Metadata } from "next";
import { SitePlanList } from "@/components/site-plans/site-plan-list";

export const metadata: Metadata = {
  title: "Site Plans · Asset Management",
};

export default function SitePlansPage() {
  return <SitePlanList />;
}
