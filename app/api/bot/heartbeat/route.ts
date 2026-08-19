import { NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot/security";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

const textOrNull = (value: unknown, max = 500) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};
const numberOrNull = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : null;
};
const allowedStatuses = new Set(["starting", "idle", "syncing", "processing", "posting", "success", "error", "stopping"]);

export async function POST(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return NextResponse.json({ error: "Bot token không hợp lệ" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const requestedStatus = String(body?.status ?? "idle").trim().toLowerCase();
  const currentStatus = allowedStatuses.has(requestedStatus) ? requestedStatus : "idle";

  const { error } = await getSocialAdminClient()
    .from("bot_devices")
    .update({
      device_name: textOrNull(body?.deviceName, 120) ?? auth.device.device_name,
      platform: textOrNull(body?.platform, 60) ?? auth.device.platform,
      app_version: textOrNull(body?.appVersion, 40) ?? auth.device.app_version,
      current_status: currentStatus,
      status_message: textOrNull(body?.message),
      current_job_id: textOrNull(body?.currentJobId, 120),
      current_step: textOrNull(body?.currentStep, 200),
      progress_percent: numberOrNull(body?.progress, 0, 100),
      current_group_count: numberOrNull(body?.currentGroupCount, 0, 10000),
      total_group_count: numberOrNull(body?.totalGroupCount, 0, 10000),
      last_error: textOrNull(body?.lastError, 2000),
      activity_updated_at: now,
      last_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("id", auth.device.id);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ success: true, serverTime: now, licenseActive: true, deviceId: auth.device.id });
}

