import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body?.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Thiếu ID tin đăng" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("listings")
      .update({
        published_at: now,
      })
      .eq("id", id)
      .select("id, published_at")
      .single();

    if (error) {
      console.error("Refresh listing error:", error);

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: data,
    });
  } catch (error) {
    console.error("Refresh listing API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể làm mới tin",
      },
      { status: 500 }
    );
  }
}