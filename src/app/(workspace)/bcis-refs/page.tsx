import type { Metadata } from "next";
import { BcisRefList } from "@/components/bcis-refs/bcis-ref-list";

export const metadata: Metadata = {
  title: "BCIS references · Asset Management",
};

export default function BcisRefsPage() {
  return <BcisRefList />;
}
