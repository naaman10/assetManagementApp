import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.toString());
  const label = session?.user.name || session?.user.email;

  return label ? (
    <h1 className="text-4xl font-medium tracking-tight">{label}</h1>
  ) : null;
}
