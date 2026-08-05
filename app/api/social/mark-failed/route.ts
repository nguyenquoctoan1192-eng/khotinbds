import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";
export async function POST(request: Request) {
  const { jobId, error } = await request.json();
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 });
  const db = getSocialAdminClient();
  const { data: job } = await db.from("social_post_jobs").select("attempt_count").eq("id", jobId).single();
  const attempts = Number(job?.attempt_count || 0) + 1;
  const next = new Date(Date.now() + Math.min(60, attempts * 10) * 60_000).toISOString();
  await db.from("social_post_jobs").update({ status: attempts >= 3 ? "failed" : "pending", attempt_count: attempts, last_error: String(error || "Không rõ lỗi"), scheduled_at: next }).eq("id", jobId);
  return NextResponse.json({ ok: true, attempts });
}
