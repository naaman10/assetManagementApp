import type { Metadata } from "next";
import { BcisSubRefDetail } from "@/components/bcis-sub-refs/bcis-sub-ref-detail";

export const metadata: Metadata = {
  title: "BCIS sub reference · Asset Management",
};

export default async function BcisSubRefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BcisSubRefDetail id={id} />;
}
