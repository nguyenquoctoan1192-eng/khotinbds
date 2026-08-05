import { NextResponse } from "next/server";
import { getServerProfile } from "@/lib/serverAuth";
import { getSocialAdminClient } from "@/lib/socialSupabase";
import { normalizeVietnamPhone } from "@/lib/socialContent";
import { sha256 } from "@/lib/bot/security";

export const dynamic = "force-dynamic";

async function requireAgent() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved" || profile.role !== "agent") return null;
  return profile;
}

async function loadSettings(agentUserId: string) {
  const db = getSocialAdminClient();
  const { data: brokerProfile, error } = await db
    .from("bot_broker_profiles")
    .select("id,license_id,agent_user_id,display_name,default_contact_phone,is_active,updated_at")
    .eq("agent_user_id", agentUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!brokerProfile) {
    return {
      linked: false,
      profile: null,
      devices: [],
      facebookAccounts: [],
      readyToPost: false,
      stats: { waiting: 0, processing: 0, posted: 0, failed: 0, groupsPosted: 0 },
      recentJobs: [],
    };
  }

  const [{ data: devices }, { data: accounts }, { data: license }] = await Promise.all([
    db
      .from("bot_devices")
      .select("id,device_uid,device_name,platform,app_version,is_active,last_seen_at,current_status,status_message,current_step,progress_percent,current_group_count,total_group_count,last_error")
      .eq("license_id", brokerProfile.license_id)
      .order("last_seen_at", { ascending: false, nullsFirst: false }),
    db
      .from("facebook_accounts")
      .select("id,name,profile_url,is_active,last_group_sync_at,synced_group_count,broker_profile_id")
      .eq("license_id", brokerProfile.license_id)
      .order("created_at", { ascending: true }),
    db
      .from("bot_licenses")
      .select("id,name,is_active,expires_at")
      .eq("id", brokerProfile.license_id)
      .maybeSingle(),
  ]);

  const accountIds = (accounts ?? []).map((account) => account.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let recentJobs: Array<Record<string, unknown>> = [];
  if (accountIds.length > 0) {
    const { data: jobs, error: jobsError } = await db
      .from("social_post_jobs")
      .select("id,listing_id,facebook_account_id,facebook_group_id,status,scheduled_at,posted_at,last_error,attempt_count,created_at")
      .in("facebook_account_id", accountIds)
      .order("created_at", { ascending: false })
      .limit(40);
    if (jobsError) throw new Error(jobsError.message);
    recentJobs = jobs ?? [];
  }

  const todayJobs = recentJobs.filter((job) => {
    const raw = String(job.created_at ?? job.scheduled_at ?? "");
    return raw && new Date(raw) >= today;
  });

  const statusOf = (job: Record<string, unknown>) => String(job.status ?? "").toLowerCase();
  const stats = {
    waiting: todayJobs.filter((job) => ["queued", "pending", "waiting", "scheduled"].includes(statusOf(job))).length,
    processing: todayJobs.filter((job) => ["processing", "posting", "running", "claimed"].includes(statusOf(job))).length,
    posted: todayJobs.filter((job) => ["posted", "success", "completed"].includes(statusOf(job))).length,
    failed: todayJobs.filter((job) => ["failed", "error"].includes(statusOf(job))).length,
    groupsPosted: todayJobs.filter((job) => ["posted", "success", "completed"].includes(statusOf(job))).length,
  };

  return {
    linked: true,
    profile: brokerProfile,
    license: license ?? null,
    devices: devices ?? [],
    facebookAccounts: accounts ?? [],
    readyToPost: Boolean(brokerProfile.default_contact_phone && brokerProfile.is_active),
    stats,
    recentJobs: recentJobs.slice(0, 8),
  };
}

export async function GET() {
  try {
    const agent = await requireAgent();
    if (!agent) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
    return NextResponse.json(await loadSettings(agent.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không tải được cài đặt Bot" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const agent = await requireAgent();
    if (!agent) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const licenseKey = String(body?.licenseKey ?? "").trim();
    if (!licenseKey) return NextResponse.json({ error: "Vui lòng nhập mã License Bot" }, { status: 400 });

    const db = getSocialAdminClient();
    const { data: license, error: licenseError } = await db
      .from("bot_licenses")
      .select("id,name,is_active,expires_at")
      .eq("license_key_hash", sha256(licenseKey))
      .maybeSingle();

    if (licenseError) throw new Error(licenseError.message);
    if (!license?.is_active) return NextResponse.json({ error: "License không hợp lệ hoặc đã bị khóa" }, { status: 400 });
    if (license.expires_at && new Date(license.expires_at) <= new Date()) {
      return NextResponse.json({ error: "License đã hết hạn" }, { status: 400 });
    }

    const { data: existingByAgent } = await db
      .from("bot_broker_profiles")
      .select("id,license_id")
      .eq("agent_user_id", agent.id)
      .maybeSingle();

    if (existingByAgent && existingByAgent.license_id !== license.id) {
      return NextResponse.json({ error: "Tài khoản môi giới này đã liên kết với một License khác" }, { status: 409 });
    }

    const { data: existingByLicense } = await db
      .from("bot_broker_profiles")
      .select("id,agent_user_id")
      .eq("license_id", license.id)
      .maybeSingle();

    if (existingByLicense?.agent_user_id && existingByLicense.agent_user_id !== agent.id) {
      return NextResponse.json({ error: "License này đã được liên kết với một môi giới khác" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: brokerProfile, error: upsertError } = await db
      .from("bot_broker_profiles")
      .upsert({ license_id: license.id, agent_user_id: agent.id, is_active: true, updated_at: now }, { onConflict: "license_id" })
      .select("id")
      .single();

    if (upsertError || !brokerProfile) throw new Error(upsertError?.message || "Không liên kết được License");

    await Promise.all([
      db.from("bot_devices").update({ broker_profile_id: brokerProfile.id }).eq("license_id", license.id),
      db.from("facebook_accounts").update({ broker_profile_id: brokerProfile.id }).eq("license_id", license.id),
    ]);

    return NextResponse.json({ success: true, ...(await loadSettings(agent.id)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không liên kết được Bot" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const agent = await requireAgent();
    if (!agent) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const displayName = String(body?.displayName ?? "").trim().slice(0, 120) || null;
    const phone = normalizeVietnamPhone(body?.defaultContactPhone);
    const facebookAccountId = String(body?.facebookAccountId ?? "").trim() || null;

    if (!phone) return NextResponse.json({ error: "Số điện thoại mặc định không hợp lệ" }, { status: 400 });

    const db = getSocialAdminClient();
    const { data: brokerProfile } = await db
      .from("bot_broker_profiles")
      .select("id,license_id")
      .eq("agent_user_id", agent.id)
      .maybeSingle();

    if (!brokerProfile) return NextResponse.json({ error: "Tài khoản chưa liên kết License Bot" }, { status: 400 });

    const { error: updateError } = await db
      .from("bot_broker_profiles")
      .update({ display_name: displayName, default_contact_phone: phone, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", brokerProfile.id);

    if (updateError) throw new Error(updateError.message);

    if (facebookAccountId) {
      const { data: account } = await db
        .from("facebook_accounts")
        .select("id")
        .eq("id", facebookAccountId)
        .eq("license_id", brokerProfile.license_id)
        .maybeSingle();

      if (!account) return NextResponse.json({ error: "Tài khoản Facebook không thuộc License này" }, { status: 400 });

      await db.from("facebook_accounts").update({ broker_profile_id: null }).eq("broker_profile_id", brokerProfile.id).neq("id", facebookAccountId);
      await db.from("facebook_accounts").update({ broker_profile_id: brokerProfile.id }).eq("id", facebookAccountId);
    }

    return NextResponse.json({ success: true, ...(await loadSettings(agent.id)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không lưu được cài đặt Bot" }, { status: 500 });
  }
}
