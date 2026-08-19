import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

type SocialPostJob = {
  id: string;
  batch_id: string;
  listing_id: string;
  facebook_account_id: string;
  facebook_group_id: string;
  content_version: number;
  content: string;
  status: string;
  facebook_post_url: string | null;
  posted_at: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const jobId = String(body?.jobId || "").trim();
    const facebookPostUrl =
      body?.facebookPostUrl || body?.facebook_post_url || null;

    if (!jobId) {
      return NextResponse.json(
        { error: "Thiếu jobId" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    /*
     * Đọc đầy đủ job để tạo history.
     */
    const { data: jobData, error: jobError } = await db
  .from("social_post_jobs")
  .select(
    [
      "id",
      "batch_id",
      "listing_id",
      "facebook_account_id",
      "facebook_group_id",
      "content_version",
      "content",
      "status",
      "facebook_post_url",
      "posted_at",
    ].join(","),
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
     * IDEMPOTENT:
     *
     * social_post_history có UNIQUE INDEX trên job_id.
     * Nếu callback Facebook/worker chạy lại, không tạo history thứ 2.
     */
    const { data: existingHistory, error: historyCheckError } =
      await db
        .from("social_post_history")
        .select("id,job_id,batch_id,facebook_post_url,posted_at")
        .eq("job_id", jobId)
        .maybeSingle();

    if (historyCheckError) {
      return NextResponse.json(
        { error: historyCheckError.message },
        { status: 500 },
      );
    }

    if (existingHistory) {
      /*
       * Job đã được ghi history trước đó.
       * Đảm bảo job cũng ở trạng thái posted rồi trả thành công.
       */
      if (job.status !== "posted") {
        const { error: updateExistingJobError } = await db
          .from("social_post_jobs")
          .update({
            status: "posted",
            posted_at:
              existingHistory.posted_at ||
              new Date().toISOString(),
            facebook_post_url:
              existingHistory.facebook_post_url ||
              facebookPostUrl ||
              null,
          })
          .eq("id", jobId);

        if (updateExistingJobError) {
          return NextResponse.json(
            { error: updateExistingJobError.message },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({
        ok: true,
        alreadyPosted: true,
        historyId: existingHistory.id,
        jobId,
      });
    }

    /*
     * Nếu job đã posted nhưng history chưa có:
     * vẫn tạo history còn thiếu.
     *
     * Trường hợp này hữu ích để repair dữ liệu nếu trước đây
     * mark-posted update job thành công nhưng history thất bại.
     */
    const postedAt =
      job.posted_at || new Date().toISOString();

    /*
     * GHI HISTORY:
     * - job_id: bắt buộc phải có
     * - batch_id: lấy trực tiếp từ job
     */
    const { data: history, error: historyError } = await db
      .from("social_post_history")
      .insert({
        job_id: job.id,
        batch_id: job.batch_id,
        listing_id: job.listing_id,
        facebook_account_id: job.facebook_account_id,
        facebook_group_id: job.facebook_group_id,
        content_version: job.content_version,
        content: job.content,
        posted_at: postedAt,
        facebook_post_url:
          facebookPostUrl ||
          job.facebook_post_url ||
          null,
      })
      .select(
        "id,job_id,batch_id,listing_id,facebook_post_url,posted_at",
      )
      .maybeSingle();

    if (historyError) {
      /*
       * UNIQUE(job_id) có thể bị request khác insert trước.
       * Khi đó đọc lại history và coi callback là idempotent.
       */
      const duplicate =
        historyError.code === "23505" ||
        /duplicate|unique/i.test(historyError.message);

      if (duplicate) {
        const { data: duplicateHistory } = await db
          .from("social_post_history")
          .select("id,job_id,batch_id,facebook_post_url,posted_at")
          .eq("job_id", jobId)
          .maybeSingle();

        if (duplicateHistory) {
          await db
            .from("social_post_jobs")
            .update({
              status: "posted",
              posted_at:
                duplicateHistory.posted_at || postedAt,
              facebook_post_url:
                duplicateHistory.facebook_post_url ||
                facebookPostUrl ||
                null,
            })
            .eq("id", jobId);

          return NextResponse.json({
            ok: true,
            alreadyPosted: true,
            historyId: duplicateHistory.id,
            jobId,
          });
        }
      }

      return NextResponse.json(
        { error: historyError.message },
        { status: 500 },
      );
    }

    /*
     * History đã tồn tại => job chuyển posted.
     */
    const { data: updatedJob, error: updateError } = await db
      .from("social_post_jobs")
      .update({
        status: "posted",
        posted_at: postedAt,
        facebook_post_url:
          facebookPostUrl ||
          job.facebook_post_url ||
          null,
        last_error: null,
        error_code: null,
        error_type: null,
        next_retry_at: null,
      })
      .eq("id", jobId)
      .select("id,status,posted_at,facebook_post_url")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      alreadyPosted: false,
      historyId: history?.id || null,
      job: updatedJob,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đánh dấu job đã đăng",
      },
      { status: 500 },
    );
  }
}

