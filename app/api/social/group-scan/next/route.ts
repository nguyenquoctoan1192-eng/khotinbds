import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const accountId = new URL(request.url).searchParams.get("accountId")?.trim();

    if (!accountId) {
      return NextResponse.json({ error: "Thiếu accountId" }, { status: 400 });
    }

    const db = getSocialAdminClient();
    const { data: candidate, error } = await db
      .from("facebook_group_scan_requests")
      .select("id")
      .eq("facebook_account_id", accountId)
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!candidate) return NextResponse.json({ request: null });

    const { data: claimed, error: claimError } = await db
      .from("facebook_group_scan_requests")
      .update({ status: "processing", claimed_at: new Date().toISOString(), last_error: null })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("id,status")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    return NextResponse.json({ request: claimed ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lấy được yêu cầu quét nhóm" },
      { status: 500 },
    );
  }
}
