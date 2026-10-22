import type { Metadata } from "next";
import { Nrm3ClassificationList } from "@/components/nrm3-classifications/nrm3-classification-list";

export const metadata: Metadata = {
  title: "NRM3 classifications · Asset Management",
};

export default function Nrm3ClassificationsPage() {
  return <Nrm3ClassificationList />;
}
