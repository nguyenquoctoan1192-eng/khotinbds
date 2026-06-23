import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScoring } from "@/lib/leadScoring";
import { authorizeRequest } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req, ["admin", "agent"]);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Không có quyền cập nhật." }, { status: 403 });
    }

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

    let accessQuery = supabase.from("leads").select("id").eq("id", leadId);
    if (auth.profile.role === "agent") accessQuery = accessQuery.eq("assigned_to", auth.profile.id);
    const { data: accessibleLead } = await accessQuery.maybeSingle();
    if (!accessibleLead) {
      return NextResponse.json({ success: false, error: "Bạn không phụ trách khách hàng này." }, { status: 403 });
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

    const { data: lead } = await supabase
      .from("leads")
      .select("phone, max_price, preferred_districts, note")
      .eq("id", leadId)
      .single();
    const leadScoring = calculateLeadScoring({
      ...(lead || {}),
      activities: [data],
    });

    await supabase
      .from("leads")
      .update(leadScoring)
      .eq("id", leadId);

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
