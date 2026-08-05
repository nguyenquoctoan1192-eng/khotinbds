import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

type ReleaseJobBody = {
  jobId?: string;
  note?: string;
};

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const body =
      (await request.json()) as ReleaseJobBody;

    const jobId =
      body.jobId?.trim();

    if (!jobId) {
      return NextResponse.json(
        {
          error: "Thiếu jobId",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: currentJob,
      error: readError,
    } = await supabase
      .from("social_post_jobs")
      .select(
        "id, status, attempt_count",
      )
      .eq("id", jobId)
      .maybeSingle();

    if (readError) {
      return NextResponse.json(
        {
          error: readError.message,
          code: readError.code,
        },
        {
          status: 500,
        },
      );
    }

    if (!currentJob) {
      return NextResponse.json(
        {
          error: "Không tìm thấy job",
        },
        {
          status: 404,
        },
      );
    }

    if (
      currentJob.status !==
      "processing"
    ) {
      return NextResponse.json(
        {
          error:
            "Job không ở trạng thái processing",
          currentStatus:
            currentJob.status,
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: releasedJob,
      error: updateError,
    } = await supabase
      .from("social_post_jobs")
      .update({
        status: "pending",
        error_type: null,
        error_code: null,
        last_error: null,
        next_retry_at: null,
        result_note:
          body.note?.trim() ||
          "Job được trả lại hàng đợi sau DRY RUN.",
      })
      .eq("id", jobId)
      .eq("status", "processing")
      .select(
        [
          "id",
          "status",
          "attempt_count",
          "error_type",
          "error_code",
          "last_error",
          "next_retry_at",
          "result_note",
        ].join(","),
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
          code: updateError.code,
        },
        {
          status: 500,
        },
      );
    }

    if (!releasedJob) {
      return NextResponse.json(
        {
          error:
            "Không thể release job vì trạng thái đã thay đổi",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      success: true,
      action: "released",
      job: releasedJob,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}