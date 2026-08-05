import { NextResponse } from "next/server";

import {
  getDb,
  getLogicalPostKey,
  getOwnedFacebookAccount,
  loadListingsByIds,
  requireBotAuth,
  unauthorizedResponse,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PendingJobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string | null;
  facebook_group_id: string | null;
  content: string | null;
  status: string;
  scheduled_at: string | null;
  attempt_count: number | null;
  last_error: string | null;
  created_at: string;
};

type GroupRow = {
  id: string;
  name: string;
  url: string | null;
  district: string | null;
  category: string | null;
};

type QueueGroup = {
  key: string;
  representative: PendingJobRow;
  jobs: PendingJobRow[];
};

function groupPendingJobs(jobs: PendingJobRow[]): QueueGroup[] {
  const map = new Map<string, QueueGroup>();

  for (const job of jobs) {
    const key = getLogicalPostKey(job);
    const existing = map.get(key);

    if (existing) {
      existing.jobs.push(job);

      const oldTime =
        existing.representative.scheduled_at ??
        existing.representative.created_at;
      const newTime = job.scheduled_at ?? job.created_at;

      if (newTime < oldTime) existing.representative = job;
    } else {
      map.set(key, { key, representative: job, jobs: [job] });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aTime =
      a.representative.scheduled_at ??
      a.representative.created_at;
    const bTime =
      b.representative.scheduled_at ??
      b.representative.created_at;

    return aTime.localeCompare(bTime);
  });
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id: accountId } = await context.params;
    const account = await getOwnedFacebookAccount(auth, accountId);

    if (!account) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy tài khoản Facebook thuộc license này",
        },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 50),
    );

    const db = getDb();

    const jobsResult = await db
      .from("social_post_jobs")
      .select(
        [
          "id","batch_id","listing_id","facebook_group_id",
          "content","status","scheduled_at","attempt_count",
          "last_error","created_at",
        ].join(","),
      )
      .eq("facebook_account_id", accountId)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true })
      .limit(Math.min(2000, limit * 20));

    if (jobsResult.error) {
      throw new Error(jobsResult.error.message);
    }

    const jobs =
      (jobsResult.data ?? []) as unknown as PendingJobRow[];

    const grouped = groupPendingJobs(jobs);
    const selectedGroups = grouped.slice(0, limit);

    const listingIds = selectedGroups
      .map((group) => group.representative.listing_id)
      .filter((value): value is string => Boolean(value));

    const listingMap = await loadListingsByIds(listingIds);

    const facebookGroupIds = Array.from(
      new Set(
        selectedGroups.flatMap((group) =>
          group.jobs
            .map((job) => job.facebook_group_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    );

    let facebookGroups: GroupRow[] = [];

    if (facebookGroupIds.length > 0) {
      const groupsResult = await db
        .from("facebook_groups")
        .select("id,name,url,district,category")
        .in("id", facebookGroupIds);

      if (groupsResult.error) {
        throw new Error(groupsResult.error.message);
      }

      facebookGroups =
        (groupsResult.data ?? []) as unknown as GroupRow[];
    }

    const groupMap = new Map(
      facebookGroups.map((group) => [String(group.id), group]),
    );

    const queue = selectedGroups.map((group) => {
      const representative = group.representative;

      const groupIds = Array.from(
        new Set(
          group.jobs
            .map((job) => job.facebook_group_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      return {
        id: representative.id,
        logicalKey: group.key,
        batchId: representative.batch_id,
        listingId: representative.listing_id,
        content: representative.content,
        status: "pending",
        scheduledAt: representative.scheduled_at,
        createdAt: representative.created_at,
        attemptCount: Math.max(
          ...group.jobs.map(
            (job) => Number(job.attempt_count ?? 0),
          ),
          0,
        ),
        lastError:
          group.jobs.find((job) => job.last_error)?.last_error ?? null,
        jobCount: group.jobs.length,
        totalGroups: groupIds.length,
        groups: groupIds
          .map((groupId) => groupMap.get(groupId))
          .filter((row): row is GroupRow => Boolean(row)),
        listing: representative.listing_id
          ? listingMap.get(String(representative.listing_id)) ?? null
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      accountId,
      queue,
      total: grouped.length,
      returned: queue.length,
      rawJobCount: jobs.length,
      groupedBy: "batch_id_or_listing_id",
      readOnly: true,
    });
  } catch (error) {
    console.error("[BOT QUEUE READ ERROR]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được hàng chờ",
      },
      { status: 500 },
    );
  }
}
