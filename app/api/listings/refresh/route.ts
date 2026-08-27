import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu ID tin đăng",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Kiểm tra tin có tồn tại
    const { data: existingListing, error: findError } =
      await supabase
        .from("listings")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (findError) {
      console.error("REFRESH FIND ERROR:", findError);

      return NextResponse.json(
        {
          success: false,
          message: "Không thể tìm tin đăng",
          error: findError.message,
        },
        { status: 500 }
      );
    }

    if (!existingListing) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy tin đăng",
        },
        { status: 404 }
      );
    }

    // RESET NGÀY ĐĂNG = THỜI GIAN HIỆN TẠI
    const { data, error: updateError } = await supabase
      .from("listings")
      .update({
        published_at: now,
      })
      .eq("id", id)
      .select("id, published_at")
      .single();

    if (updateError) {
      console.error("REFRESH UPDATE ERROR:", updateError);

      return NextResponse.json(
        {
          success: false,
          message: "Không thể cập nhật ngày đăng",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đã làm mới tin đăng",
      listing: data,
      published_at: data.published_at,
    });
  } catch (error) {
    console.error("REFRESH API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Lỗi máy chủ khi làm mới tin",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}