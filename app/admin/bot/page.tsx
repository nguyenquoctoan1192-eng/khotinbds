import { redirect } from "next/navigation";
import BotAdminClient from "./BotAdminClient";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function BotAdminPage() {
  const profile = await getServerProfile();

  if (!profile) {
    redirect("/login?next=/admin/bot");
  }

  if (profile.status !== "approved" || profile.role !== "admin") {
    redirect("/");
  }

  return <BotAdminClient />;
}

