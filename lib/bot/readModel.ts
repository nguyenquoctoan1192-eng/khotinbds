import { authenticateBot } from "@/lib/bot/security";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export type BotAuth = NonNullable<
  Awaited<ReturnType<typeof authenticateBot>>
>;

export type FacebookAccountRow = {
  id: string;
  name: string;
  is_active: boolean;
  license_id: string | null;
  broker_profile_id: string | null;
  external_uid: string | null;
  facebook_user_id: string | null;
  profile_url: string | null;
  status: string | null;
  health_status: string | null;
  paused_until: string | null;
  daily_post_limit: number | null;
  hourly_post_limit: number | null;
  posts_today: number | null;
  posts_this_hour: number | null;
  last_checkpoint_at: string | null;
  last_captcha_at: string | null;
  last_error: string | null;
  posting_mode: string | null;
  start_time: string | null;
  end_time: string | null;
  interval_min_minutes: number | null;
  interval_max_minutes: number | null;
  max_posts_per_day: number | null;
  last_group_sync_at: string | null;
  synced_group_count: number | null;
  created_at: string;
  updated_at: string | null;
};

export type ListingSummary = {
  id: string;
  title: string | null;
  district: string | null;
  address: string | null;
  price: number | null;
  area: number | null;
  width: number | null;
  length: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  images: unknown;
  status: string | null;
};

type CountJobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string | null;
  status: string;
  scheduled_at: string | null;
};

export function unauthorizedResponse() {
  return Response.json(
    { error: "Token Bot MG không hợp lệ hoặc đã hết hạn" },
    { status: 401 },
  );
}

export async function requireBotAuth(request: Request) {
  return authenticateBot(request);
}

export function getDb() {
  return getSocialAdminClient();
}

export function getLicenseId(auth: BotAuth): string {
  return String(auth.license.id);
}

export function getLogicalPostKey(job: {
  batch_id?: string | null;
  listing_id?: string | null;
  id?: string | null;
}): string {
  if (job.batch_id) return `batch:${job.batch_id}`;
  if (job.listing_id) return `listing:${job.listing_id}`;
  return `job:${job.id ?? "unknown"}`;
}

export async function getBrokerProfileId(
  auth: BotAuth,
): Promise<string | null> {
  const db = getDb();

  const { data, error } = await db
    .from("bot_broker_profiles")
    .select("id")
    .eq("license_id", getLicenseId(auth))
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as unknown as { id?: string | null } | null;
  return row?.id ? String(row.id) : null;
}

export async function getOwnedFacebookAccount(
  auth: BotAuth,
  accountId: string,
): Promise<FacebookAccountRow | null> {
  const db = getDb();
  const licenseId = getLicenseId(auth);
  const brokerProfileId = await getBrokerProfileId(auth);

  let query = db
    .from("facebook_accounts")
    .select(
      [
        "id","name","is_active","license_id","broker_profile_id",
        "external_uid","facebook_user_id","profile_url","status",
        "health_status","paused_until","daily_post_limit",
        "hourly_post_limit","posts_today","posts_this_hour",
        "last_checkpoint_at","last_captcha_at","last_error",
        "posting_mode","start_time","end_time",
        "interval_min_minutes","interval_max_minutes",
        "max_posts_per_day","last_group_sync_at",
        "synced_group_count","created_at","updated_at",
      ].join(","),
    )
    .eq("id", accountId);

  if (brokerProfileId) {
    query = query.or(
      `license_id.eq.${licenseId},broker_profile_id.eq.${brokerProfileId}`,
    );
  } else {
    query = query.eq("license_id", licenseId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as FacebookAccountRow | null) ?? null;
}

export async function listOwnedFacebookAccounts(
  auth: BotAuth,
): Promise<FacebookAccountRow[]> {
  const db = getDb();
  const licenseId = getLicenseId(auth);
  const brokerProfileId = await getBrokerProfileId(auth);

  let query = db
    .from("facebook_accounts")
    .select(
      [
        "id","name","is_active","license_id","broker_profile_id",
        "external_uid","facebook_user_id","profile_url","status",
        "health_status","paused_until","daily_post_limit",
        "hourly_post_limit","posts_today","posts_this_hour",
        "last_checkpoint_at","last_captcha_at","last_error",
        "posting_mode","start_time","end_time",
        "interval_min_minutes","interval_max_minutes",
        "max_posts_per_day","last_group_sync_at",
        "synced_group_count","created_at","updated_at",
      ].join(","),
    )
    .order("created_at", { ascending: true });

  if (brokerProfileId) {
    query = query.or(
      `license_id.eq.${licenseId},broker_profile_id.eq.${brokerProfileId}`,
    );
  } else {
    query = query.eq("license_id", licenseId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FacebookAccountRow[];
}

export async function loadListingsByIds(
  listingIds: string[],
): Promise<Map<string, ListingSummary>> {
  const ids = Array.from(new Set(listingIds.map(String).filter(Boolean)));
  if (ids.length === 0) return new Map();

  const db = getDb();
  const { data, error } = await db
    .from("listings")
    .select(
      "id,title,district,address,price,area,width,length,floors,bedrooms,bathrooms,description,images,status",
    )
    .in("id", ids);

  if (error) throw new Error(error.message);

  const listings = (data ?? []) as unknown as ListingSummary[];
  return new Map(
    listings.map((listing) => [String(listing.id), listing]),
  );
}

function countLogicalPosts(
  jobs: CountJobRow[],
  acceptedStatuses: string[],
): number {
  const statusSet = new Set(acceptedStatuses);

  return new Set(
    jobs
      .filter((job) => statusSet.has(job.status))
      .map(getLogicalPostKey),
  ).size;
}

export async function getAccountCounts(accountId: string) {
  const db = getDb();
  const now = new Date().toISOString();

  const [groupsResult, jobsResult] = await Promise.all([
    db
      .from("facebook_groups")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .or(
        `facebook_account_id.eq.${accountId},facebook_account_id.is.null`,
      ),
    db
      .from("social_post_jobs")
      .select("id,batch_id,listing_id,status,scheduled_at")
      .eq("facebook_account_id", accountId)
      .in("status", ["pending","processing","posted","failed"]),
  ]);

  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (jobsResult.error) throw new Error(jobsResult.error.message);

  const jobs = (jobsResult.data ?? []) as unknown as CountJobRow[];

  const scheduledKeys = new Set(
    jobs
      .filter(
        (job) =>
          job.status === "pending" &&
          Boolean(job.scheduled_at) &&
          String(job.scheduled_at) >= now,
      )
      .map(getLogicalPostKey),
  );

  return {
    groups: groupsResult.count ?? 0,
    queue: countLogicalPosts(jobs, ["pending"]),
    processing: countLogicalPosts(jobs, ["processing"]),
    posted: countLogicalPosts(jobs, ["posted"]),
    failed: countLogicalPosts(jobs, ["failed"]),
    scheduled: scheduledKeys.size,
  };
}

export function serializeAccount(
  account: FacebookAccountRow,
  counts?: Awaited<ReturnType<typeof getAccountCounts>>,
) {
  return {
    id: account.id,
    name: account.name,
    isActive: account.is_active,
    licenseId: account.license_id,
    brokerProfileId: account.broker_profile_id,
    externalUid: account.external_uid,
    facebookUserId: account.facebook_user_id,
    profileUrl: account.profile_url,
    status: account.status,
    healthStatus: account.health_status,
    pausedUntil: account.paused_until,
    limits: {
      daily: account.daily_post_limit,
      hourly: account.hourly_post_limit,
      maxPerDay: account.max_posts_per_day,
    },
    counters: {
      postsToday: account.posts_today,
      postsThisHour: account.posts_this_hour,
    },
    posting: {
      mode: account.posting_mode,
      startTime: account.start_time,
      endTime: account.end_time,
      intervalMinMinutes: account.interval_min_minutes,
      intervalMaxMinutes: account.interval_max_minutes,
    },
    groupSync: {
      lastSyncedAt: account.last_group_sync_at,
      syncedCount: account.synced_group_count,
    },
    lastCheckpointAt: account.last_checkpoint_at,
    lastCaptchaAt: account.last_captcha_at,
    lastError: account.last_error,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    counts: counts ?? null,
  };
}
