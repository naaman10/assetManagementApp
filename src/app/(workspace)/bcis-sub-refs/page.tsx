import type { Metadata } from "next";
import { BcisSubRefList } from "@/components/bcis-sub-refs/bcis-sub-ref-list";

export const metadata: Metadata = {
  title: "BCIS sub references · Asset Management",
};

export default function BcisSubRefsPage() {
  return <BcisSubRefList />;
}
