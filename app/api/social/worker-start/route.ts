import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

const WORKER_START_VERSION = "worker-start-job-only-v2";

const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 6;

type QueueRow = {
  id: string;
  batch_id: string | null;
  listing_id: string;
  status: string;
  scheduled_at: string | null;
  created_at?: string | null;
};

type QueueUnit = {
  key: string;
  batchId: string | null;
  listingId: string;
  firstScheduledAt: string | null;
  firstCreatedAt: string | null;
};

function randomIntervalMinutes(): number {
  return (
    Math.floor(
      Math.random() *
        (MAX_INTERVAL_MINUTES - MIN_INTERVAL_MINUTES + 1),
    ) + MIN_INTERVAL_MINUTES
  );
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? timestamp
    : Number.MAX_SAFE_INTEGER;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const accountId = String(
      body?.accountId ||
        body?.facebookAccountId ||
        body?.facebook_account_id ||
        "",
    ).trim();

    if (!accountId) {
      return NextResponse.json(
        { error: "Thiếu accountId" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    const { data: account, error: accountError } = await db
      .from("facebook_accounts")
      .select("id,is_active,status")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);

    if (!account) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản Facebook" },
        { status: 404 },
      );
    }

    if (
      account.is_active === false ||
      (account.status && account.status !== "active")
    ) {
      return NextResponse.json(
        { error: "Tài khoản Facebook đang tắt hoặc không hoạt động" },
        { status: 409 },
      );
    }

    /*
     * Khi bot tắt, mọi tin chỉ nằm chờ.
     * Khi bot khởi động, lấy toàn bộ pending/failed của đúng tài khoản,
     * gom theo batch/listing để một tin chỉ có một mốc thời gian.
     */
    const { data, error } = await db
      .from("social_post_jobs")
      .select(
        "id,batch_id,listing_id,status,scheduled_at,created_at",
      )
      .eq("facebook_account_id", accountId)
      .in("status", ["pending", "failed"])
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as QueueRow[];
    const unitMap = new Map<string, QueueUnit>();

    for (const row of rows) {
      const key = row.batch_id
        ? `batch:${row.batch_id}`
        : `listing:${row.listing_id}`;

      const current = unitMap.get(key);

      if (!current) {
        unitMap.set(key, {
          key,
          batchId: row.batch_id,
          listingId: row.listing_id,
          firstScheduledAt: row.scheduled_at,
          firstCreatedAt: row.created_at ?? null,
        });
        continue;
      }

      if (
        toTimestamp(row.scheduled_at) <
        toTimestamp(current.firstScheduledAt)
      ) {
        current.firstScheduledAt = row.scheduled_at;
      }

      if (
        toTimestamp(row.created_at) <
        toTimestamp(current.firstCreatedAt)
      ) {
        current.firstCreatedAt = row.created_at ?? null;
      }
    }

    const units = [...unitMap.values()].sort((a, b) => {
      const scheduledDifference =
        toTimestamp(a.firstScheduledAt) -
        toTimestamp(b.firstScheduledAt);

      if (scheduledDifference !== 0) {
        return scheduledDifference;
      }

      return (
        toTimestamp(a.firstCreatedAt) -
        toTimestamp(b.firstCreatedAt)
      );
    });

    let scheduledAt = new Date();
    const schedule: Array<{
      listingId: string;
      batchId: string | null;
      scheduledAt: string;
      delayMinutesFromPrevious: number;
    }> = [];

    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];

      /*
       * Tin đầu tiên luôn đăng ngay khi bot khởi động.
       * Từ tin thứ hai mới cộng ngẫu nhiên 1–6 phút.
       */
      const delayMinutes =
        index === 0 ? 0 : randomIntervalMinutes();

      if (delayMinutes > 0) {
        scheduledAt = new Date(
          scheduledAt.getTime() +
            delayMinutes * 60 * 1000,
        );
      }

      let jobQuery = db
        .from("social_post_jobs")
        .update({
          status: "pending",
          scheduled_at: scheduledAt.toISOString(),
          next_retry_at: null,
          claimed_at: null,
          attempt_count: 0,
          last_error: null,
          error_code: null,
          error_type: null,
        })
        .eq("facebook_account_id", accountId)
        .in("status", ["pending", "failed"]);

      jobQuery = unit.batchId
        ? jobQuery.eq("batch_id", unit.batchId)
        : jobQuery.eq("listing_id", unit.listingId);

      const { error: updateError } = await jobQuery;

      if (updateError) throw new Error(updateError.message);

      schedule.push({
        listingId: unit.listingId,
        batchId: unit.batchId,
        scheduledAt: scheduledAt.toISOString(),
        delayMinutesFromPrevious: delayMinutes,
      });
    }

    return NextResponse.json({
      success: true,
      version: WORKER_START_VERSION,
      facebookAccountId: accountId,
      queuedListings: units.length,
      firstListingScheduledImmediately: units.length > 0,
      intervalMinutes: {
        min: MIN_INTERVAL_MINUTES,
        max: MAX_INTERVAL_MINUTES,
      },
      schedule,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không xếp được lịch khi worker khởi động",
      },
      { status: 500 },
    );
  }
}
