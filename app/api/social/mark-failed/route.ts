import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

type SocialPostJob = {
  id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  claimed_at: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const jobId = String(body?.jobId || "").trim();
    const errorMessage = String(
      body?.error || "Không rõ lỗi",
    ).trim();

    if (!jobId) {
      return NextResponse.json(
        { error: "Thiếu jobId" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    /*
     * Đọc job hiện tại.
     */
    const { data: jobData, error: jobError } = await db
  .from("social_post_jobs")
  .select(
    "id,status,attempt_count,max_attempts,next_retry_at,last_error,claimed_at",
  )
  .eq("id", jobId)
  .maybeSingle();

const job = jobData as SocialPostJob | null;

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 500 },
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Không tìm thấy job" },
        { status: 404 },
      );
    }

    /*
     * Nếu job đã posted thì không được biến nó thành failed/pending.
     */
    if (job.status === "posted") {
      return NextResponse.json({
        ok: true,
        alreadyPosted: true,
        attempts: Number(job.attempt_count || 0),
      });
    }

    const attempts =
      Number(job.attempt_count || 0) + 1;

    const maxAttempts =
      Number(job.max_attempts || 3);

    /*
     * Retry:
     *
     * attempt 1 -> 10 phút
     * attempt 2 -> 20 phút
     * attempt 3 -> failed, không retry nữa
     *
     * QUAN TRỌNG:
     * dùng next_retry_at, KHÔNG dùng scheduled_at.
     */
    const shouldFail = attempts >= maxAttempts;

    const nextRetryAt = shouldFail
      ? null
      : new Date(
          Date.now() +
            Math.min(60, attempts * 10) * 60_000,
        ).toISOString();

    const nextStatus = shouldFail
      ? "failed"
      : "pending";

    const { data: updatedJobData, error: updateError } =
  await db
    .from("social_post_jobs")
    .update({
      status: nextStatus,
      attempt_count: attempts,
      last_error: errorMessage,
      next_retry_at: nextRetryAt,
      claimed_at: null,
      error_code: null,
      error_type: null,
    })
    .eq("id", jobId)
    .neq("status", "posted")
    .select(
      [
        "id",
        "status",
        "attempt_count",
        "max_attempts",
        "last_error",
        "next_retry_at",
        "claimed_at",
      ].join(","),
    )
    .maybeSingle();

const updatedJob = updatedJobData as SocialPostJob | null;

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    /*
     * Trường hợp request khác đã thay đổi job trước khi update.
     */
    if (!updatedJob) {
      const { data: currentJob } = await db
        .from("social_post_jobs")
        .select(
          "id,status,attempt_count,max_attempts,last_error,next_retry_at",
        )
        .eq("id", jobId)
        .maybeSingle();

      if (currentJob?.status === "posted") {
        return NextResponse.json({
          ok: true,
          alreadyPosted: true,
          attempts: Number(
            currentJob.attempt_count || 0,
          ),
        });
      }

      return NextResponse.json(
        {
          error:
            "Job đã được request khác xử lý",
          job: currentJob || null,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      attempts,
      maxAttempts,
      status: updatedJob.status,
      nextRetryAt: updatedJob.next_retry_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đánh dấu job failed",
      },
      { status: 500 },
    );
  }
}

