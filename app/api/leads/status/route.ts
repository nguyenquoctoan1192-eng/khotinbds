import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScoring } from "@/lib/leadScoring";
import { authorizeRequest } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const auth = await authorizeRequest(req, ["admin", "agent"]);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Không có quyền cập nhật." }, { status: 403 });
    }

    const body = await req.json();
    const leadId = String(body.lead_id || "").trim();
    const newStatus = String(body.status || "").trim();

    if (!leadId || !newStatus) {
      return NextResponse.json(
        { success: false, error: "Thiếu trạng thái khách." },
        { status: 400 }
      );
    }

    let leadQuery = supabase
      .from("leads")
      .select("status, phone, max_price, preferred_districts, note")
      .eq("id", leadId);
    if (auth.profile.role === "agent") leadQuery = leadQuery.eq("assigned_to", auth.profile.id);
    const { data: lead, error: leadError } = await leadQuery.single();

    if (leadError) {
      throw leadError;
    }

    const oldStatus = String(lead?.status || "Khách mới");

    const leadScoring = calculateLeadScoring(lead || {});

    let updateQuery = supabase
      .from("leads")
      .update({
        status: newStatus,
        ...leadScoring,
      })
      .eq("id", leadId);
    if (auth.profile.role === "agent") updateQuery = updateQuery.eq("assigned_to", auth.profile.id);
    const { data: updatedLead, error: updateError } = await updateQuery
      .select("id, status, lead_score, lead_temperature")
      .single();

    if (updateError) {
      throw updateError;
    }

    const { data: activity, error: activityError } = await supabase
      .from("lead_activities")
      .insert([
        {
          lead_id: leadId,
          type: "Trạng thái",
          content: `Chuyển trạng thái: ${oldStatus} → ${newStatus}`,
        },
      ])
      .select("id, lead_id, type, content, created_at")
      .single();

    if (activityError) {
      throw activityError;
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không cập nhật được trạng thái.",
      },
      { status: 500 }
    );
  }
}
