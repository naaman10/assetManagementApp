import type { Metadata } from "next";
import { ClientList } from "@/components/clients/client-list";

export const metadata: Metadata = {
  title: "Clients · Asset Management",
};

export default function ClientsPage() {
  return <ClientList />;
}
