import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => null);

  const jobId = String(
    url.searchParams.get("id") ?? body?.id ?? body?.jobId ?? "",
  ).trim();

  let listingId = String(
    url.searchParams.get("listingId") ?? body?.listingId ?? "",
  ).trim();

  if (!jobId && !listingId) {
    return NextResponse.json(
      { error: "Thiếu id tin hoặc listingId" },
      { status: 400 },
    );
  }

  const db = getSocialAdminClient();

  if (!listingId && jobId) {
    const { data: job, error } = await db
      .from("social_post_jobs")
      .select("listing_id")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "Không tìm thấy tin" }, { status: 404 });
    }

    listingId = String(job.listing_id);
  }

  const { data: jobs, error: findError } = await db
    .from("social_post_jobs")
    .select("id,batch_id,status")
    .eq("listing_id", listingId);

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!jobs?.length) {
    return NextResponse.json(
      { error: "Tin này không còn trong hàng chờ" },
      { status: 404 },
    );
  }

  if (jobs.some((job) => job.status === "processing")) {
    return NextResponse.json(
      { error: "Worker đang xử lý tin này, chưa thể xóa" },
      { status: 409 },
    );
  }

  const batchIds = [
    ...new Set(
      jobs
        .map((job) => String(job.batch_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  const { error: deleteError } = await db
    .from("social_post_jobs")
    .delete()
    .eq("listing_id", listingId)
    .neq("status", "processing");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (batchIds.length > 0) {
    const { error: batchDeleteError } = await db
      .from("social_post_batches")
      .delete()
      .in("id", batchIds);

    if (batchDeleteError) {
      return NextResponse.json(
        { error: batchDeleteError.message },
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
