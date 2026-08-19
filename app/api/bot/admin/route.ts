import { NextResponse } from "next/server";
import { createLicenseKey, sha256 } from "@/lib/bot/security";
import { getServerProfile } from "@/lib/serverAuth";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const profile = await getServerProfile();
  return profile?.status === "approved" && profile.role === "admin" ? profile : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Bạn không có quyền quản lý Bot" }, { status: 403 });
  }

  const db = getSocialAdminClient();
  const [licensesResult, devicesResult, accountsResult, groupsResult, jobsResult] = await Promise.all([
    db
      .from("bot_licenses")
      .select("id,name,license_key_prefix,is_active,max_devices,max_facebook_accounts,expires_at,last_used_at,created_at")
      .order("created_at", { ascending: false }),
    db
      .from("bot_devices")
      .select("id,license_id,device_uid,device_name,platform,app_version,is_active,last_ip,last_seen_at,token_expires_at,created_at,current_status,status_message,current_job_id,current_step,progress_percent,current_group_count,total_group_count,last_error,activity_updated_at")
      .order("last_seen_at", { ascending: false, nullsFirst: false }),
    db
      .from("facebook_accounts")
      .select("id,name,profile_url,is_active,license_id,last_group_sync_at,synced_group_count,created_at")
      .order("created_at", { ascending: false }),
    db
      .from("facebook_groups")
      .select("id,name,url,is_active,facebook_account_id,facebook_group_id,source,last_synced_at")
      .order("name", { ascending: true }),
    db
      .from("social_post_jobs")
      .select("id,listing_id,facebook_account_id,facebook_group_id,status,scheduled_at,posted_at,last_error,attempt_count,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const error =
    licensesResult.error ||
    devicesResult.error ||
    accountsResult.error ||
    groupsResult.error ||
    jobsResult.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    licenses: licensesResult.data ?? [],
    devices: devicesResult.data ?? [],
    accounts: accountsResult.data ?? [],
    groups: groupsResult.data ?? [],
    jobs: jobsResult.data ?? [],
    serverTime: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Bạn không có quyền tạo license" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Thiếu tên license" }, { status: 400 });
    }

    const maxDevices = Math.min(100, Math.max(1, Number(body?.maxDevices) || 1));
    const maxFacebookAccounts = Math.min(100, Math.max(1, Number(body?.maxFacebookAccounts) || 1));
    const expiresAt = body?.expiresAt ? new Date(String(body.expiresAt)) : null;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "Ngày hết hạn không hợp lệ" }, { status: 400 });
    }

    const licenseKey = createLicenseKey();
    const { data, error } = await getSocialAdminClient()
      .from("bot_licenses")
      .insert({
        name,
        license_key_hash: sha256(licenseKey),
        license_key_prefix: licenseKey.slice(0, 12),
        is_active: true,
        max_devices: maxDevices,
        max_facebook_accounts: maxFacebookAccounts,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      })
      .select("id,name,license_key_prefix,is_active,max_devices,max_facebook_accounts,expires_at,last_used_at,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ license: data, licenseKey }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không tạo được license" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật Bot" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const type = String(body?.type ?? "").trim();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = getSocialAdminClient();

    if (type === "license") {
      const { error } = await db
        .from("bot_licenses")
        .update({ is_active: body?.isActive === true, updated_at: now })
        .eq("id", id);

      return error
        ? NextResponse.json({ error: error.message }, { status: 500 })
        : NextResponse.json({ success: true });
    }

    if (type === "device") {
      const patch: Record<string, unknown> = {
        is_active: body?.isActive === true,
        updated_at: now,
      };

      if (body?.resetToken === true) {
        patch.token_hash = null;
        patch.token_expires_at = null;
      }

      const { error } = await db.from("bot_devices").update(patch).eq("id", id);
      return error
        ? NextResponse.json({ error: error.message }, { status: 500 })
        : NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Loại cập nhật không hợp lệ" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không cập nhật được Bot" },
      { status: 400 },
    );
  }
}

