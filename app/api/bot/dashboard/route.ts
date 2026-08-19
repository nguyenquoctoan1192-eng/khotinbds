import { NextResponse } from "next/server";
import { getServerProfile } from "@/lib/serverAuth";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getServerProfile();

  if (!profile || profile.status !== "approved") {
    return NextResponse.json(
      { error: "Tài khoản chưa được phê duyệt" },
      { status: 403 },
    );
  }

  const db = getSocialAdminClient();

  // Admin should use /api/admin/bot to see the whole system.
  // This endpoint always returns only the current user's own bot data.
  const { data: licenses, error: licenseError } = await db
    .from("bot_licenses")
    .select(
      "id,name,license_key_prefix,license_type,is_active,max_devices,max_facebook_accounts,expires_at,last_used_at,created_at",
    )
    .eq("owner_user_id", profile.id)
    .order("created_at", { ascending: false });

  if (licenseError) {
    return NextResponse.json(
      { error: licenseError.message },
      { status: 500 },
    );
  }

  const licenseIds = (licenses ?? []).map((item) => item.id);

  if (licenseIds.length === 0) {
    return NextResponse.json({
      licenses: [],
      devices: [],
      accounts: [],
      groups: [],
      jobs: [],
      serverTime: new Date().toISOString(),
    });
  }

  const [devicesResult, accountsResult] = await Promise.all([
    db
      .from("bot_devices")
      .select(
        "id,license_id,device_uid,device_name,platform,app_version,is_active,last_seen_at,current_status,status_message,current_job_id,current_step,progress_percent,current_group_count,total_group_count,last_error,activity_updated_at",
      )
      .in("license_id", licenseIds)
      .order("last_seen_at", { ascending: false, nullsFirst: false }),
    db
      .from("facebook_accounts")
      .select(
        "id,name,profile_url,is_active,license_id,last_group_sync_at,synced_group_count,created_at",
      )
      .in("license_id", licenseIds)
      .order("created_at", { ascending: false }),
  ]);

  const firstError = devicesResult.error || accountsResult.error;
  if (firstError) {
    return NextResponse.json(
      { error: firstError.message },
      { status: 500 },
    );
  }

  const accountIds = (accountsResult.data ?? []).map((item) => item.id);

  if (accountIds.length === 0) {
    return NextResponse.json({
      licenses: licenses ?? [],
      devices: devicesResult.data ?? [],
      accounts: [],
      groups: [],
      jobs: [],
      serverTime: new Date().toISOString(),
    });
  }

  const [groupsResult, jobsResult] = await Promise.all([
    db
      .from("facebook_groups")
      .select(
        "id,name,url,is_active,facebook_account_id,facebook_group_id,source,last_synced_at",
      )
      .in("facebook_account_id", accountIds)
      .order("name", { ascending: true }),
    db
      .from("social_post_jobs")
      .select(
        "id,listing_id,facebook_account_id,facebook_group_id,status,scheduled_at,posted_at,last_error,attempt_count,created_at",
      )
      .in("facebook_account_id", accountIds)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const secondError = groupsResult.error || jobsResult.error;
  if (secondError) {
    return NextResponse.json(
      { error: secondError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    licenses: licenses ?? [],
    devices: devicesResult.data ?? [],
    accounts: accountsResult.data ?? [],
    groups: groupsResult.data ?? [],
    jobs: jobsResult.data ?? [],
    serverTime: new Date().toISOString(),
  });
}

