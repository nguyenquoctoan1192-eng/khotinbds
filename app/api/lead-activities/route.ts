import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = String(body.lead_id || "").trim();
    const type = String(body.type || "").trim();
    const content = String(body.content || "").trim();

    if (!leadId || !type || !content) {
      return NextResponse.json(
        { success: false, error: "Thiếu thông tin hoạt động." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("lead_activities")
      .insert([
        {
          lead_id: leadId,
          type,
          content,
        },
      ])
      .select("id, lead_id, type, content, created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, activity: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không lưu được hoạt động.",
      },
      { status: 500 }
    );
  }
}
