import { NextResponse } from "next/server";
import { createBotToken, sha256 } from "@/lib/bot/security";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const licenseKey = clean(body?.licenseKey);
    const deviceUid = clean(body?.deviceUid);
    const deviceName = clean(body?.deviceName) || "Máy tính Windows";
    const platform = clean(body?.platform) || "windows";
    const appVersion = clean(body?.appVersion) || null;

    if (!licenseKey || !deviceUid) {
      return NextResponse.json(
        { error: "Thiếu licenseKey hoặc deviceUid" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    const { data: license, error: licenseError } = await db
      .from("bot_licenses")
      .select("id,name,is_active,max_devices,max_facebook_accounts,expires_at")
      .eq("license_key_hash", sha256(licenseKey))
      .maybeSingle();

    if (licenseError) {
      return NextResponse.json({ error: licenseError.message }, { status: 500 });
    }

    if (!license?.is_active) {
      return NextResponse.json(
        { error: "License không hợp lệ hoặc đã bị khóa" },
        { status: 401 },
      );
    }

    if (
      license.expires_at &&
      new Date(license.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "License đã hết hạn" },
        { status: 401 },
      );
    }

    const { data: brokerProfile, error: brokerError } = await db
      .from("bot_broker_profiles")
      .select("id,license_id,agent_user_id,default_contact_phone,is_active")
      .eq("license_id", license.id)
      .maybeSingle();

    if (brokerError) {
      return NextResponse.json({ error: brokerError.message }, { status: 500 });
    }

    if (!brokerProfile) {
      return NextResponse.json(
        {
          error: "Key KTB chưa được gắn với tài khoản môi giới trên web",
          code: "LICENSE_NOT_LINKED",
        },
        { status: 403 },
      );
    }

    if (brokerProfile.is_active === false) {
      return NextResponse.json(
        {
          error: "Tài khoản môi giới đã bị khóa",
          code: "BROKER_DISABLED",
        },
        { status: 403 },
      );
    }

    const { data: existingDevice, error: existingDeviceError } = await db
      .from("bot_devices")
      .select("id,is_active")
      .eq("license_id", license.id)
      .eq("device_uid", deviceUid)
      .maybeSingle();

    if (existingDeviceError) {
      return NextResponse.json(
        { error: existingDeviceError.message },
        { status: 500 },
      );
    }

    if (existingDevice && !existingDevice.is_active) {
      return NextResponse.json(
        { error: "Thiết bị này đã bị khóa" },
        { status: 403 },
      );
    }

    if (!existingDevice) {
      const { count, error: countError } = await db
        .from("bot_devices")
        .select("id", { count: "exact", head: true })
        .eq("license_id", license.id)
        .eq("is_active", true);

      if (countError) {
        return NextResponse.json(
          { error: countError.message },
          { status: 500 },
        );
      }

      if ((count ?? 0) >= Number(license.max_devices ?? 1)) {
        return NextResponse.json(
          {
            error: "License đã đạt giới hạn thiết bị",
            code: "DEVICE_LIMIT_REACHED",
          },
          { status: 403 },
        );
      }
    }

    const token = createBotToken();
    const nowIso = new Date().toISOString();
    const tokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const payload = {
      license_id: license.id,
      device_uid: deviceUid,
      device_name: deviceName,
      platform,
      app_version: appVersion,
      token_hash: sha256(token),
      token_expires_at: tokenExpiresAt,
      is_active: true,
      last_ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      last_seen_at: nowIso,
      updated_at: nowIso,
    };

    const { data: device, error: deviceError } = await db
      .from("bot_devices")
      .upsert(payload, { onConflict: "license_id,device_uid" })
      .select("id,device_uid,device_name")
      .single();

    if (deviceError) {
      return NextResponse.json({ error: deviceError.message }, { status: 500 });
    }

    await db
      .from("bot_licenses")
      .update({ last_used_at: nowIso, updated_at: nowIso })
      .eq("id", license.id);

    return NextResponse.json({
      success: true,
      token,
      tokenExpiresAt,
      license: {
        id: license.id,
        name: license.name,
        maxFacebookAccounts: license.max_facebook_accounts,
      },
      device,
      broker: {
        profileId: brokerProfile.id,
        userId: brokerProfile.agent_user_id,
        defaultContactPhone: brokerProfile.default_contact_phone,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đăng nhập được Bot MG",
      },
      { status: 400 },
    );
  }
}
