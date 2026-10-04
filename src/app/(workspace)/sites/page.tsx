import type { Metadata } from "next";
import { SiteList } from "@/components/sites/site-list";

export const metadata: Metadata = {
  title: "Sites · Asset Management",
};

export default function SitesPage() {
  return <SiteList />;
}
