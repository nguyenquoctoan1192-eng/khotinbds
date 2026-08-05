import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { id } = await context.params;
  const jobId = String(id || "").trim();

  if (!jobId) {
    return NextResponse.json(
      { error: "Thiếu ID lịch đăng" },
      { status: 400 },
    );
  }

  const db = getSocialAdminClient();

  const { data: job, error: lookupError } = await db
    .from("social_post_jobs")
    .select("id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: lookupError.message },
      { status: 500 },
    );
  }

  if (!job) {
    return NextResponse.json(
      { error: "Không tìm thấy lịch đăng" },
      { status: 404 },
    );
  }

  const { error: deleteError } = await db
    .from("social_post_jobs")
    .delete()
    .eq("id", jobId);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `Không xóa được lịch đăng: ${deleteError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedJob: {
      id: job.id,
      status: job.status,
    },
  });
}