import type { Metadata } from "next";
import { CreateNrm3Classification } from "@/components/nrm3-classifications/create-nrm3-classification";

export const metadata: Metadata = {
  title: "New NRM3 classification · Asset Management",
};

export default function NewNrm3ClassificationPage() {
  return <CreateNrm3Classification />;
}
