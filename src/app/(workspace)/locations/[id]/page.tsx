import type { Metadata } from "next";
import { LocationDetail } from "@/components/locations/location-detail";

export const metadata: Metadata = {
  title: "Location · Asset Management",
};

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocationDetail id={id} />;
}
