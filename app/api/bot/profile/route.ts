import { NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot/security";
import { getSocialAdminClient } from "@/lib/socialSupabase";
import { normalizeVietnamPhone } from "@/lib/socialContent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return NextResponse.json({ error: "Bot token không hợp lệ" }, { status: 401 });

  const db = getSocialAdminClient();
  const { data: profile } = await db
    .from("bot_broker_profiles")
    .select("id,license_id,display_name,default_contact_phone,is_active,updated_at")
    .eq("license_id", auth.license.id)
    .maybeSingle();

  const { data: accounts } = await db
    .from("facebook_accounts")
    .select("id,name,profile_url,is_active,broker_profile_id")
    .eq("license_id", auth.license.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    profile: profile ?? null,
    device: {
      id: auth.device.id,
      deviceUid: auth.device.device_uid,
      deviceName: auth.device.device_name,
      platform: auth.device.platform,
      appVersion: auth.device.app_version,
    },
    facebookAccounts: accounts ?? [],
    readyToPost: Boolean(profile?.default_contact_phone),
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return NextResponse.json({ error: "Bot token không hợp lệ" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const displayName = String(body?.displayName ?? "").trim().slice(0, 120) || null;
  const phone = normalizeVietnamPhone(body?.defaultContactPhone);
  if (!phone) {
    return NextResponse.json({ error: "Số điện thoại mặc định không hợp lệ" }, { status: 400 });
  }

  const db = getSocialAdminClient();
  const now = new Date().toISOString();
  const { data: profile, error } = await db
    .from("bot_broker_profiles")
    .upsert({
      license_id: auth.license.id,
      display_name: displayName,
      default_contact_phone: phone,
      is_active: true,
      updated_at: now,
    }, { onConflict: "license_id" })
    .select("id,license_id,display_name,default_contact_phone,is_active,updated_at")
    .single();

  if (error || !profile) return NextResponse.json({ error: error?.message || "Không lưu được hồ sơ môi giới" }, { status: 500 });

  await db.from("bot_devices").update({ broker_profile_id: profile.id }).eq("id", auth.device.id);

  if (body?.facebookAccountId) {
    await db
      .from("facebook_accounts")
      .update({ broker_profile_id: profile.id })
      .eq("id", String(body.facebookAccountId))
      .eq("license_id", auth.license.id);
  }

  return NextResponse.json({ success: true, profile, readyToPost: true });
}

