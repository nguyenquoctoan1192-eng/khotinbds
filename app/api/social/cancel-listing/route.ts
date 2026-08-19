import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";
export async function POST(request: Request) {
  const { listingId } = await request.json();
  if (!listingId) return NextResponse.json({ error: "Thiếu listingId" }, { status: 400 });
  const { error } = await getSocialAdminClient().from("social_post_jobs").update({ status: "cancelled", last_error: "Tin đã cho thuê" }).eq("listing_id", listingId).in("status", ["pending", "processing"]);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

