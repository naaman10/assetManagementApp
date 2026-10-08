import type { Metadata } from "next";
import { BcisRefDetail } from "@/components/bcis-refs/bcis-ref-detail";

export const metadata: Metadata = {
  title: "BCIS reference · Asset Management",
};

export default async function BcisRefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BcisRefDetail id={id} />;
}
