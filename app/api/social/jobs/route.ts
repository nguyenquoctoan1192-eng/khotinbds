import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const url = new URL(request.url);

  const body = await request.json().catch(() => null);

  const db = getSocialAdminClient();

  /*
   * ============================================================
   * XÓA TẤT CẢ JOB ĐANG CHỜ
   * DELETE /api/social/jobs?status=pending
   * ============================================================
   */
  const status = String(
    url.searchParams.get("status") ??
      body?.status ??
      "",
  )
    .trim()
    .toLowerCase();

  if (status === "pending") {
    /*
     * Lấy toàn bộ job đang pending trước khi xóa
     * để biết số lượng và batch tương ứng.
     */
    const { data: pendingJobs, error: pendingFindError } =
      await db
        .from("social_post_jobs")
        .select("id,batch_id,listing_id,status")
        .eq("status", "pending");

    if (pendingFindError) {
      return NextResponse.json(
        {
          error: pendingFindError.message,
        },
        { status: 500 },
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        deletedBatches: 0,
      });
    }

    /*
     * Lấy danh sách batch ID của các job pending.
     */
    const batchIds = [
      ...new Set(
        pendingJobs
          .map((job) =>
            String(job.batch_id ?? "").trim(),
          )
          .filter(Boolean),
      ),
    ];

    /*
     * Chỉ xóa job pending.
     *
     * Job processing / posted / failed sẽ được giữ nguyên.
     */
    const { error: pendingDeleteError } =
      await db
        .from("social_post_jobs")
        .delete()
        .eq("status", "pending");

    if (pendingDeleteError) {
      return NextResponse.json(
        {
          error: pendingDeleteError.message,
        },
        { status: 500 },
      );
    }

    /*
     * Xóa các batch không còn job nào.
     *
     * Không xóa batch nếu trong batch đó vẫn còn
     * job processing / posted / failed.
     */
    let deletedBatches = 0;

    if (batchIds.length > 0) {
      const { data: remainingJobs, error: remainingError } =
        await db
          .from("social_post_jobs")
          .select("batch_id")
          .in("batch_id", batchIds);

      if (remainingError) {
        return NextResponse.json(
          {
            error: remainingError.message,
          },
          { status: 500 },
        );
      }

      const remainingBatchIds = new Set(
        (remainingJobs ?? [])
          .map((job) =>
            String(job.batch_id ?? "").trim(),
          )
          .filter(Boolean),
      );

      const emptyBatchIds = batchIds.filter(
        (batchId) =>
          !remainingBatchIds.has(batchId),
      );

      if (emptyBatchIds.length > 0) {
        const { error: batchDeleteError } =
          await db
            .from("social_post_batches")
            .delete()
            .in("id", emptyBatchIds);

        if (batchDeleteError) {
          return NextResponse.json(
            {
              error: batchDeleteError.message,
            },
            { status: 500 },
          );
        }

        deletedBatches = emptyBatchIds.length;
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: pendingJobs.length,
      deletedBatches,
    });
  }

  /*
   * ============================================================
   * XÓA 1 TIN THEO JOB ID / LISTING ID
   * ============================================================
   */

  const jobId = String(
    url.searchParams.get("id") ??
      body?.id ??
      body?.jobId ??
      "",
  ).trim();

  let listingId = String(
    url.searchParams.get("listingId") ??
      body?.listingId ??
      "",
  ).trim();

  if (!jobId && !listingId) {
    return NextResponse.json(
      {
        error: "Thiếu id tin hoặc listingId",
      },
      { status: 400 },
    );
  }

  /*
   * Nếu frontend gửi jobId thì tìm listingId tương ứng.
   */
  if (!listingId && jobId) {
    const { data: job, error } = await db
      .from("social_post_jobs")
      .select("listing_id")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 },
      );
    }

    if (!job) {
      return NextResponse.json(
        {
          error: "Không tìm thấy tin",
        },
        { status: 404 },
      );
    }

    listingId = String(job.listing_id);
  }

  /*
   * Lấy toàn bộ job của listing này.
   */
  const { data: jobs, error: findError } =
    await db
      .from("social_post_jobs")
      .select("id,batch_id,status")
      .eq("listing_id", listingId);

  if (findError) {
    return NextResponse.json(
      {
        error: findError.message,
      },
      { status: 500 },
    );
  }

  if (!jobs?.length) {
    return NextResponse.json(
      {
        error: "Tin này không còn trong hàng chờ",
      },
      { status: 404 },
    );
  }

  /*
   * Không cho xóa tin nếu worker đang xử lý.
   */
  if (
    jobs.some(
      (job) => job.status === "processing",
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Worker đang xử lý tin này, chưa thể xóa",
      },
      { status: 409 },
    );
  }

  /*
   * Lấy batch ID trước khi xóa jobs.
   */
  const batchIds = [
    ...new Set(
      jobs
        .map((job) =>
          String(job.batch_id ?? "").trim(),
        )
        .filter(Boolean),
    ),
  ];

  /*
   * Xóa toàn bộ job của listing,
   * ngoại trừ processing.
   */
  const { error: deleteError } =
    await db
      .from("social_post_jobs")
      .delete()
      .eq("listing_id", listingId)
      .neq("status", "processing");

  if (deleteError) {
    return NextResponse.json(
      {
        error: deleteError.message,
      },
      { status: 500 },
    );
  }

  /*
   * Xóa batch tương ứng.
   */
  if (batchIds.length > 0) {
    const { error: batchDeleteError } =
      await db
        .from("social_post_batches")
        .delete()
        .in("id", batchIds);

    if (batchDeleteError) {
      return NextResponse.json(
        {
          error: batchDeleteError.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    listingId,
    deletedJobs: jobs.length,
    deletedBatches: batchIds.length,
  });
}