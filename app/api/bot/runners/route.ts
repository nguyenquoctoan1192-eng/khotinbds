import { NextResponse } from "next/server";
import { requireBotAuth, unauthorizedResponse, getDb, getLicenseId } from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const db = getDb();

    const { data, error } = await db
      .from("bot_account_runners")
      .select(
        "id,facebook_account_id,bot_device_id,status,status_message,current_job_id,current_step,progress_percent,current_group_count,total_group_count,last_error,started_at,last_heartbeat_at,facebook_accounts(name),bot_devices(device_name)",
      )
      .eq("license_id", getLicenseId(auth))
      .order("last_heartbeat_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, runners: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không đọc được danh sách runner" },
      { status: 500 },
    );
  }
}