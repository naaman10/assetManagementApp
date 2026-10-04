import type { Metadata } from "next";
import { SiteDetailView } from "@/components/sites/site-detail";

export const metadata: Metadata = {
  title: "Site · Asset Management",
};

export default async function SitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SiteDetailView id={id} />;
}
