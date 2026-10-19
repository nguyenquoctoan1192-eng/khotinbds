import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

type QueueJobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string;
  scheduled_at: string;
  status: string;
};

type QueueUnit = {
  key: string;
  batchId: string | null;
  listingId: string;
  scheduledAt: Date;
};

const RESETTABLE_STATUSES = [
  "pending",
  "failed",
  "processing",
];

function randomDelayMs(): number {
  const min = 3 * 60 * 1000;
  const max = 12 * 60 * 1000;

  return (
    min +
    Math.floor(Math.random() * (max - min + 1))
  );
}

function firstScheduleTime(): Date {
  return new Date(
    Date.now() + 30 * 1000,
  );
}

function queueKey(
  job: QueueJobRow,
): string {
  return job.batch_id
    ? `batch:${job.batch_id}`
    : `listing:${job.listing_id}`;
}

function buildQueueUnits(
  rows: QueueJobRow[],
): QueueUnit[] {
  const units = new Map<
    string,
    QueueUnit
  >();

  for (const row of rows) {
    const key = queueKey(row);

    const parsed = new Date(
      row.scheduled_at,
    );

    const scheduledAt =
      Number.isNaN(parsed.getTime())
        ? new Date()
        : parsed;

    const current = units.get(key);

    if (
      !current ||
      scheduledAt.getTime() <
        current.scheduledAt.getTime()
    ) {
      units.set(key, {
        key,
        batchId: row.batch_id,
        listingId: row.listing_id,
        scheduledAt,
      });
    }
  }

  return [...units.values()].sort(
    (a, b) =>
      a.scheduledAt.getTime() -
      b.scheduledAt.getTime(),
  );
}

/**
 * Lấy TOÀN BỘ job còn nằm trong hàng chờ.
 *
 * Bao gồm:
 * pending
 * failed
 * processing
 *
 * Không lọc theo ngày.
 */
async function loadResettableJobs() {
  const db =
    getSocialAdminClient();

  const { data, error } = await db
    .from("social_post_jobs")
    .select(
      "id,batch_id,listing_id,scheduled_at,status",
    )
    .in(
      "status",
      RESETTABLE_STATUSES,
    )
    .order("scheduled_at", {
      ascending: true,
    })
    .limit(5000);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return {
    db,
    rows:
      (data ?? []) as QueueJobRow[],
  };
}

/**
 * Cập nhật toàn bộ job thuộc listing/batch.
 *
 * QUAN TRỌNG:
 * Không còn .in("status", ["pending", "failed"])
 * ở đây.
 *
 * Vì Reset phải xử lý cả processing.
 */
async function updateUnit(input: {
  db: ReturnType<
    typeof getSocialAdminClient
  >;
  unit: QueueUnit;
  scheduledAt: Date;
}) {
  const {
    db,
    unit,
    scheduledAt,
  } = input;

  let query = db
    .from("social_post_jobs")
    .update({
      status: "pending",

      scheduled_at:
        scheduledAt.toISOString(),

      next_retry_at: null,
      claimed_at: null,
      attempt_count: 0,
      last_error: null,
      error_code: null,
      error_type: null,
    })
    .in(
      "status",
      RESETTABLE_STATUSES,
    );

  if (unit.batchId) {
    query = query.eq(
      "batch_id",
      unit.batchId,
    );
  } else {
    query = query.eq(
      "listing_id",
      unit.listingId,
    );
  }

  const {
    error,
  } = await query;

  if (error) {
    throw new Error(
      error.message,
    );
  }

  /**
   * Đưa batch về pending.
   */
  if (unit.batchId) {
    const {
      error: batchError,
    } = await db
      .from(
        "social_post_batches",
      )
      .update({
        status: "pending",
      })
      .eq(
        "id",
        unit.batchId,
      )
      .in("status", [
        "pending",
        "failed",
        "cancelled",
        "processing",
      ]);

    if (batchError) {
      throw new Error(
        batchError.message,
      );
    }
  }
}

/**
 * RESET TOÀN BỘ HÀNG CHỜ
 *
 * Tin đầu tiên:
 * hiện tại + 30 giây
 *
 * Các tin tiếp:
 * cách nhau 3–12 phút.
 */
async function resetQueue() {
  const {
    db,
    rows,
  } =
    await loadResettableJobs();

  const units =
    buildQueueUnits(rows);

  let cursor =
    firstScheduleTime();

  for (
    let index = 0;
    index < units.length;
    index++
  ) {
    if (index > 0) {
      cursor =
        new Date(
          cursor.getTime() +
            randomDelayMs(),
        );
    }

    await updateUnit({
      db,
      unit: units[index],
      scheduledAt: cursor,
    });
  }

  return {
    success: true,
    action: "reset",
    queueCount:
      units.length,
    firstScheduledAt:
      units.length > 0
        ? new Date(
            Date.now() +
              30 * 1000,
          ).toISOString()
        : null,
  };
}

/**
 * ĐẨY TIN
 *
 * Tin được chọn:
 * +30 giây
 *
 * Các tin còn lại:
 * +3–12 phút.
 */
async function promoteListing(
  listingId: string,
) {
  const {
    db,
    rows,
  } =
    await loadResettableJobs();

  const units =
    buildQueueUnits(rows);

  const target =
    units.find(
      (unit) =>
        unit.listingId ===
        listingId,
    );

  if (!target) {
    throw new Error(
      "Tin này không còn ở trạng thái chờ hoặc thất bại.",
    );
  }

  const ordered = [
    target,
    ...units.filter(
      (unit) =>
        unit.key !==
        target.key,
    ),
  ];

  let cursor =
    firstScheduleTime();

  for (
    let index = 0;
    index < ordered.length;
    index++
  ) {
    if (index > 0) {
      cursor =
        new Date(
          cursor.getTime() +
            randomDelayMs(),
        );
    }

    await updateUnit({
      db,
      unit: ordered[index],
      scheduledAt: cursor,
    });
  }

  return {
    success: true,
    action: "promote",
    listingId,
    queueCount:
      ordered.length,
    firstScheduledAt:
      ordered.length > 0
        ? new Date(
            Date.now() +
              30 * 1000,
          ).toISOString()
        : null,
  };
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request
        .json()
        .catch(() => ({}))) as {
        action?: string;
        listingId?: string;
      };

    if (
      body.action ===
      "reset"
    ) {
      return NextResponse.json(
        await resetQueue(),
      );
    }

    if (
      body.action ===
      "promote"
    ) {
      const listingId =
        String(
          body.listingId ??
            "",
        ).trim();

      if (!listingId) {
        return NextResponse.json(
          {
            error:
              "Thiếu listingId cần đẩy lên đầu hàng chờ.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await promoteListing(
          listingId,
        ),
      );
    }

    return NextResponse.json(
      {
        error:
          "action phải là reset hoặc promote.",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không cập nhật được hàng chờ Facebook.",
      },
      { status: 500 },
    );
  }
}