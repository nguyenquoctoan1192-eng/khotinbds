import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");
  redirect("/admin/agents");
}
