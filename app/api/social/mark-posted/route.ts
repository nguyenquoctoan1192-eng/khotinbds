import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export async function POST(request: Request) {
  const { jobId, facebookPostUrl } = await request.json();
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 });
  const db = getSocialAdminClient();
  const { data: job, error } = await db.from("social_post_jobs").select("*").eq("id", jobId).single();
  if (error || !job) return NextResponse.json({ error: "Không tìm thấy job" }, { status: 404 });
  const postedAt = new Date().toISOString();
  const { error: he } = await db.from("social_post_history").insert({ listing_id: job.listing_id, facebook_account_id: job.facebook_account_id, facebook_group_id: job.facebook_group_id, content_version: job.content_version, posted_at: postedAt, facebook_post_url: facebookPostUrl || null });
  if (he) return NextResponse.json({ error: he.message }, { status: 500 });
  await db.from("social_post_jobs").update({ status: "posted", posted_at: postedAt, facebook_post_url: facebookPostUrl || null }).eq("id", jobId);
  return NextResponse.json({ ok: true });
}
