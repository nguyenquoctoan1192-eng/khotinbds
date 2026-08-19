import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

type Body = { accountId: string; healthStatus: "healthy"|"warming_up"|"checkpoint"|"captcha"|"rate_limited"|"paused"|"disabled"; pausedUntil?: string|null; message?: string };

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body.accountId || !body.healthStatus) return NextResponse.json({ error: "Thiếu accountId hoặc healthStatus" }, { status: 400 });
  const db = getSocialAdminClient();
  const active = ["healthy","warming_up"].includes(body.healthStatus);
  const { data, error } = await db.from("facebook_accounts").update({
    health_status: body.healthStatus,
    status: active ? "active" : "paused",
    paused_until: body.pausedUntil ?? null,
    last_error: body.message ?? null,
    last_seen_at: new Date().toISOString(),
  }).eq("id", body.accountId).select("id,name,status,health_status,paused_until").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, account: data });
}

