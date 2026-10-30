import type { Metadata } from "next";
import { SitePlanDetail } from "@/components/site-plans/site-plan-detail";

export const metadata: Metadata = {
  title: "Site plan · Asset Management",
};

export default async function SitePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SitePlanDetail id={id} />;
}
