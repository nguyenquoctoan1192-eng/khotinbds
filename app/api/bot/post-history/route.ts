import { NextResponse } from "next/server";
import {
  requireBotAuth,
  unauthorizedResponse,
  getOwnedFacebookAccount,
  getDb,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 50) || 50,
      200,
    );

    if (!accountId) {
      return NextResponse.json({ error: "Thiếu accountId" }, { status: 400 });
    }

    const owned = await getOwnedFacebookAccount(auth, accountId);
    if (!owned) {
      return NextResponse.json(
        { error: "Tài khoản Facebook không thuộc license này" },
        { status: 403 },
      );
    }

    const db = getDb();

    // Job đang pending/processing/failed (chưa hoàn tất)
    const { data: jobsData, error: jobsError } = await db
      .from("social_post_jobs")
      .select(
        "id,listing_id,content,status,last_error,error_code,scheduled_at,claimed_at,facebook_group_id,extra_group_names,facebook_groups(name)",
      )
      .eq("facebook_account_id", accountId)
      .in("status", ["pending", "processing", "failed"])
      .order("scheduled_at", { ascending: false })
      .limit(limit);

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    // Đã đăng thành công
    const { data: historyData, error: historyError } = await db
      .from("social_post_history")
      .select(
        "id,job_id,listing_id,content,facebook_group_id,facebook_post_url,posted_at,facebook_groups(name)",
      )
      .eq("facebook_account_id", accountId)
      .order("posted_at", { ascending: false })
      .limit(limit);

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    const jobs = (jobsData ?? []).map((job: any) => ({
      id: job.id,
      listingId: job.listing_id,
      content: job.content,
      status: job.status,
      lastError: job.last_error,
      errorCode: job.error_code,
      scheduledAt: job.scheduled_at,
      claimedAt: job.claimed_at,
      mainGroupName: job.facebook_groups?.name ?? null,
      extraGroupNames: Array.isArray(job.extra_group_names)
        ? job.extra_group_names
        : [],
      postedAt: null,
      facebookPostUrl: null,
    }));

    const history = (historyData ?? []).map((row: any) => ({
      id: row.id,
      listingId: row.listing_id,
      content: row.content,
      status: "posted",
      lastError: null,
      errorCode: null,
      scheduledAt: null,
      claimedAt: null,
      mainGroupName: row.facebook_groups?.name ?? null,
      extraGroupNames: [],
      postedAt: row.posted_at,
      facebookPostUrl: row.facebook_post_url,
    }));

    const combined = [...jobs, ...history].sort((a, b) => {
      const timeA = new Date(a.postedAt || a.scheduledAt || 0).getTime();
      const timeB = new Date(b.postedAt || b.scheduledAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      items: combined.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được lịch sử đăng bài",
      },
      { status: 500 },
    );
  }
}