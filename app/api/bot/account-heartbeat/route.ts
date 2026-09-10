import { NextResponse } from "next/server";
import {
  requireBotAuth,
  unauthorizedResponse,
  getOwnedFacebookAccount,
  getDb,
  getLicenseId,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const facebookAccountId = String(body?.facebookAccountId || "").trim();

    if (!facebookAccountId) {
      return NextResponse.json({ error: "Thiếu facebookAccountId" }, { status: 400 });
    }

    const owned = await getOwnedFacebookAccount(auth, facebookAccountId);
    if (!owned) {
      return NextResponse.json(
        { error: "Tài khoản Facebook không thuộc license này" },
        { status: 403 },
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    const payload = {
      license_id: getLicenseId(auth),
      bot_device_id: auth.device.id,
      facebook_account_id: facebookAccountId,
      process_pid: body?.pid ?? null,
      chrome_cdp_port: body?.cdpPort ?? null,
      status: body?.status ?? "idle",
      status_message: body?.message ?? null,
      current_job_id: body?.currentJobId ?? null,
      current_step: body?.currentStep ?? null,
      progress_percent: body?.progress ?? null,
      current_group_count: body?.currentGroupCount ?? null,
      total_group_count: body?.totalGroupCount ?? null,
      last_error: body?.lastError ?? null,
      last_heartbeat_at: now,
      updated_at: now,
      stopped_at: body?.status === "stopped" ? now : null,
    };

    const { data, error } = await db
      .from("bot_account_runners")
      .upsert(payload, { onConflict: "facebook_account_id" })
      .select("id,status,last_heartbeat_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, runner: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không cập nhật được trạng thái" },
      { status: 400 },
    );
  }
}