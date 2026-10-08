import type { Metadata } from "next";
import { WorkOrderList } from "@/components/work-orders/work-order-list";

export const metadata: Metadata = {
  title: "Work orders · Asset Management",
};

export default function WorkOrdersPage() {
  return <WorkOrderList />;
}
