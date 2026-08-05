import { NextResponse } from "next/server";
import {
  getDb,
  getOwnedFacebookAccount,
  loadListingsByIds,
  requireBotAuth,
  unauthorizedResponse,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LogItem = {
  id: string;
  type: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
  occurredAt: string;
  jobId?: string;
  listingId?: string;
  listingTitle?: string | null;
  postUrl?: string | null;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await context.params;
    const account = await getOwnedFacebookAccount(auth, id);

    if (!account) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản Facebook thuộc license này" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit")) || 100),
    );

    const db = getDb();
    const [{ data: jobs, error: jobsError }, { data: history, error: historyError }] =
      await Promise.all([
        db
          .from("social_post_jobs")
          .select(
            "id,listing_id,status,scheduled_at,posted_at,facebook_post_url,attempt_count,last_error,created_at",
          )
          .eq("facebook_account_id", id)
          .order("created_at", { ascending: false })
          .limit(limit),
        db
          .from("social_post_history")
          .select(
            "id,listing_id,posted_at,facebook_post_url,content_version",
          )
          .eq("facebook_account_id", id)
          .order("posted_at", { ascending: false })
          .limit(limit),
      ]);

    if (jobsError) throw new Error(jobsError.message);
    if (historyError) throw new Error(historyError.message);

    const listingIds = [
      ...(jobs ?? []).map((item) => String(item.listing_id)),
      ...(history ?? []).map((item) => String(item.listing_id)),
    ];
    const listingMap = await loadListingsByIds(listingIds);
    const logs: LogItem[] = [];

    if (account.last_error) {
      logs.push({
        id: `account-error-${account.id}`,
        type: "account_error",
        level: "error",
        message: account.last_error,
        occurredAt:
          account.updated_at ??
          account.last_checkpoint_at ??
          account.created_at,
      });
    }

    for (const job of jobs ?? []) {
      const listing = listingMap.get(String(job.listing_id));
      const status = String(job.status ?? "");
      const occurredAt = String(
        job.posted_at ?? job.scheduled_at ?? job.created_at,
      );

      logs.push({
        id: `job-${job.id}-${status}`,
        type: `job_${status}`,
        level:
          status === "posted"
            ? "success"
            : status === "failed"
              ? "error"
              : status === "cancelled"
                ? "warning"
                : "info",
        message:
          status === "posted"
            ? "Đăng bài thành công"
            : status === "failed"
              ? `Đăng bài thất bại${job.last_error ? `: ${job.last_error}` : ""}`
              : status === "processing"
                ? "Đang xử lý bài đăng"
                : status === "cancelled"
                  ? "Job đã bị hủy"
                  : "Tin đang chờ đăng",
        occurredAt,
        jobId: String(job.id),
        listingId: String(job.listing_id),
        listingTitle: listing?.title ?? null,
        postUrl: job.facebook_post_url ?? null,
      });
    }

    for (const item of history ?? []) {
      const listing = listingMap.get(String(item.listing_id));
      logs.push({
        id: `history-${item.id}`,
        type: "post_history",
        level: "success",
        message: "Đã ghi nhận lịch sử đăng Facebook",
        occurredAt: String(item.posted_at),
        listingId: String(item.listing_id),
        listingTitle: listing?.title ?? null,
        postUrl: item.facebook_post_url ?? null,
      });
    }

    logs.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() -
        new Date(a.occurredAt).getTime(),
    );

    return NextResponse.json({
      success: true,
      accountId: id,
      logs: logs.slice(0, limit),
      total: Math.min(logs.length, limit),
      derived: true,
      note:
        "Nhật ký được tổng hợp từ social_post_jobs, social_post_history và facebook_accounts.last_error.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được nhật ký hoạt động",
      },
      { status: 500 },
    );
  }
}
