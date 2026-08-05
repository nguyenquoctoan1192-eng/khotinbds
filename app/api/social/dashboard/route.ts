import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSocialAdminClient();

    const [jobsResult, accountsResult, groupsResult] =
      await Promise.all([
        db
          .from("social_post_jobs")
          .select(`
            id,status,scheduled_at,posted_at,content,listing_id,facebook_account_id,
            facebook_accounts(name),
            facebook_groups(name,url,district)
          `)
          .in("status", ["pending", "processing", "failed"])
          .order("scheduled_at", { ascending: true })
          .limit(150),

        db
          .from("facebook_accounts")
          .select(`
            id,name,profile_url,is_active,posting_mode,start_time,end_time,
            interval_min_minutes,interval_max_minutes,max_posts_per_day
          `)
          .order("created_at", { ascending: true }),

        db
          .from("facebook_groups")
          .select("id,name,url,district,category,priority,is_active")
          .eq("is_active", true)
          .order("priority", { ascending: true })
          .order("name", { ascending: true })
          .limit(500),
      ]);

    if (jobsResult.error) throw jobsResult.error;
    if (accountsResult.error) throw accountsResult.error;
    if (groupsResult.error) throw groupsResult.error;

    const accounts = accountsResult.data ?? [];

    const progress = await Promise.all(
      accounts.map(async (account) => {
        const [pending, processing, posted, failed, total] =
          await Promise.all([
            db.from("social_post_jobs")
              .select("id", { count: "exact", head: true })
              .eq("facebook_account_id", account.id)
              .eq("status", "pending"),

            db.from("social_post_jobs")
              .select("id", { count: "exact", head: true })
              .eq("facebook_account_id", account.id)
              .eq("status", "processing"),

            db.from("social_post_jobs")
              .select("id", { count: "exact", head: true })
              .eq("facebook_account_id", account.id)
              .in("status", ["posted", "completed", "success"]),

            db.from("social_post_jobs")
              .select("id", { count: "exact", head: true })
              .eq("facebook_account_id", account.id)
              .eq("status", "failed"),

            db.from("social_post_jobs")
              .select("id", { count: "exact", head: true })
              .eq("facebook_account_id", account.id),
          ]);

        return {
          accountId: account.id,
          pending: pending.count ?? 0,
          processing: processing.count ?? 0,
          posted: posted.count ?? 0,
          failed: failed.count ?? 0,
          total: total.count ?? 0,
        };
      }),
    );

    const stats = progress.reduce(
      (sum, row) => ({
        pending: sum.pending + row.pending,
        processing: sum.processing + row.processing,
        posted: sum.posted + row.posted,
        failed: sum.failed + row.failed,
      }),
      { pending: 0, processing: 0, posted: 0, failed: 0 },
    );

    return NextResponse.json(
      {
        accounts,
        groups: groupsResult.data ?? [],
        jobs: jobsResult.data ?? [],
        progress,
        stats,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được Social Publisher",
      },
      { status: 500 },
    );
  }
}
