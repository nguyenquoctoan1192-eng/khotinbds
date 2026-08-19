import { NextResponse } from "next/server";
import { createBotToken, sha256 } from "@/lib/bot/security";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const licenseKey = String(body?.licenseKey ?? "").trim();
    const deviceUid = String(body?.deviceUid ?? "").trim();
    const deviceName = String(body?.deviceName ?? "Máy tính Windows").trim();
    const platform = String(body?.platform ?? "windows").trim();
    const appVersion = body?.appVersion
      ? String(body.appVersion).trim()
      : null;

    if (!licenseKey || !deviceUid) {
      return NextResponse.json(
        { error: "Thiếu licenseKey hoặc deviceUid" },
        { status: 400 }
      );
    }

    const db = getSocialAdminClient();

    console.log("License nhập:", licenseKey);
    console.log("Hash tạo ra:", sha256(licenseKey));

    const { data: license, error: licenseError } = await db
      .from("bot_licenses")
      .select("id,name,is_active,max_devices,max_facebook_accounts,expires_at")
      .eq("license_key_hash", sha256(licenseKey))
      .maybeSingle();

    console.log("License tìm thấy:", license);
    console.log("License error:", licenseError);

    if (licenseError) {
      return NextResponse.json(
        { error: licenseError.message },
        { status: 500 }
      );
    }

    if (!license?.is_active) {
      return NextResponse.json(
        { error: "License không hợp lệ hoặc đã bị khóa" },
        { status: 401 }
      );
    }

    if (
      license.expires_at &&
      new Date(license.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "License đã hết hạn" },
        { status: 401 }
      );
    }

    const { data: existing, error: existingError } = await db
      .from("bot_devices")
      .select("id,is_active")
      .eq("license_id", license.id)
      .eq("device_uid", deviceUid)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      const { count, error: countError } = await db
        .from("bot_devices")
        .select("id", { count: "exact", head: true })
        .eq("license_id", license.id)
        .eq("is_active", true);

      if (countError) {
        return NextResponse.json(
          { error: countError.message },
          { status: 500 }
        );
      }

      if ((count ?? 0) >= Number(license.max_devices ?? 1)) {
        return NextResponse.json(
          { error: "License đã đạt giới hạn thiết bị" },
          { status: 403 }
        );
      }
    } else if (!existing.is_active) {
      return NextResponse.json(
        { error: "Thiết bị này đã bị khóa" },
        { status: 403 }
      );
    }

    const token = createBotToken();
    const nowIso = new Date().toISOString();
    const tokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const payload = {
      license_id: license.id,
      device_uid: deviceUid,
      device_name: deviceName || null,
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đăng nhập được Bot MG",
      },
      { status: 400 }
    );
  }
}

