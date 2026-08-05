import { NextResponse } from "next/server";
import {
  selectCrosspostGroups,
  type GroupCandidate,
} from "@/lib/socialPosting";
import { getSocialAdminClient } from "@/lib/socialSupabase";
import {
  ADMIN_DEFAULT_CONTACT_PHONE,
  finalizeFacebookContent,
} from "@/lib/socialContent";

export const dynamic = "force-dynamic";

const TOTAL_GROUPS = 10;
const EXTRA_GROUPS = 9;

type Db = ReturnType<typeof getSocialAdminClient>;

type ListingRow = {
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

type FacebookGroupRow = {
  id: string;
  name: string | null;
  url: string | null;
  district: string | null;
  districts?: unknown;
  category: string | null;
  priority: number | string | null;
  is_active: boolean | null;
  group_status: string | null;
  muted_until: string | null;
  daily_post_limit: number | null;
  allowed_start_hour: number | null;
  allowed_end_hour: number | null;
};

type BatchRow = {
  id: string;
  listing_id: string;
  facebook_account_id: string;
  status: string;
  contact_phone_snapshot?: string | null;
};

type JobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string;
  facebook_group_id: string;
  facebook_account_id: string;
  content: string;
  scheduled_at: string;
  attempt_count: number | null;
  max_attempts?: number | null;
  next_retry_at?: string | null;
  facebook_groups?: FacebookGroupRow | FacebookGroupRow[] | null;
};

function normalizePhone(value: unknown): string {
  return String(value ?? "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeGroupName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[✅🔥•·|]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueGroupsByFacebookName(
  groups: FacebookGroupRow[],
): FacebookGroupRow[] {
  const usedNames = new Set<string>();
  const usedUrls = new Set<string>();
  const output: FacebookGroupRow[] = [];

  for (const group of groups) {
    const nameKey = normalizeGroupName(group.name);
    const urlKey = String(group.url ?? "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase();

    if (!nameKey || !urlKey) continue;
    if (usedNames.has(nameKey) || usedUrls.has(urlKey)) continue;

    usedNames.add(nameKey);
    usedUrls.add(urlKey);
    output.push(group);
  }

  return output;
}

function normalizeDistrictArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      return normalizeDistrictArray(JSON.parse(value));
    } catch {
      return value
        .split(/[,;/|]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function toGroupCandidate(group: FacebookGroupRow): GroupCandidate {
  const priority = Number(group.priority);

  return {
    id: String(group.id),
    name: String(group.name ?? "").trim(),
    district: String(group.district ?? "").trim() || null,
    districts: normalizeDistrictArray(group.districts),
    category: String(group.category ?? "general").trim(),
    priority: Number.isFinite(priority) ? priority : 100,
  } as GroupCandidate;
}

function detectCategories(listing: ListingRow): string[] {
  const source = normalizeText(
    [listing.title, listing.address, listing.description]
      .filter(Boolean)
      .join(" "),
  );

  const categories = new Set<string>(["whole-house", "general"]);

  if (/\bmat tien\b|\bmt\b|showroom/.test(source)) {
    categories.add("frontage");
    categories.add("business");
  }

  if (/van phong/.test(source)) categories.add("office");
  if (/phong tro|can ho dich vu/.test(source)) categories.add("room");

  if (/kinh doanh|spa|nha hang|quan an|cafe|ca phe/.test(source)) {
    categories.add("business");
  }

  return [...categories];
}

function buildBaseContent(listing: ListingRow): string {
  const dimensions =
    listing.width && listing.length
      ? `${listing.width}x${listing.length}m`
      : listing.area
        ? `${listing.area}m²`
        : "";

  const structure = [
    listing.floors ? `${listing.floors} tầng` : "",
    listing.bedrooms ? `${listing.bedrooms} phòng ngủ` : "",
    listing.bathrooms ? `${listing.bathrooms} WC` : "",
  ].filter(Boolean);

  return [
    `🔥 ${String(listing.title || "CHO THUÊ BẤT ĐỘNG SẢN").trim()}`,
    listing.district ? `📍 ${listing.district}` : "",
    dimensions ? `📐 Diện tích: ${dimensions}` : "",
    structure.length ? `🏢 ${structure.join(" – ")}` : "",
    listing.price
      ? `💰 Giá thuê: ${Number(listing.price).toLocaleString("vi-VN")} đồng/tháng`
      : "",
    String(listing.description ?? "").trim(),
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}


function isListingUnavailable(status: unknown): boolean {
  const normalized = normalizeText(status);

  if (!normalized) return false;

  /*
   * Chỉ chặn các trạng thái thật sự đã ngừng đăng.
   * Không yêu cầu status bắt buộc phải đúng duy nhất là "available",
   * vì dữ liệu hiện tại có thể dùng active/published/pending/null.
   */
  return [
    "rented",
    "leased",
    "unavailable",
    "inactive",
    "cancelled",
    "canceled",
    "deleted",
    "archived",
    "da cho thue",
    "da thue",
    "ngung dang",
    "tam ngung",
  ].includes(normalized);
}

function vietnamHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

function insideHours(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

async function getDefaultPhone(
  db: Db,
  account: {
    license_id: string | null;
    broker_profile_id: string | null;
  },
): Promise<string> {
  const adminFallbackPhone =
    normalizePhone(ADMIN_DEFAULT_CONTACT_PHONE) || "0946497253";

  let query = db
    .from("bot_broker_profiles")
    .select("default_contact_phone,is_active");

  if (account.broker_profile_id) {
    query = query.eq("id", account.broker_profile_id);
  } else if (account.license_id) {
    query = query.eq("license_id", account.license_id);
  } else {
    return adminFallbackPhone;
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.warn(
      "[NEXT-JOB] Không đọc được hồ sơ môi giới, dùng SĐT mặc định:",
      error.message,
    );
    return adminFallbackPhone;
  }

  if (!data || data.is_active === false) {
    return adminFallbackPhone;
  }

  return (
    normalizePhone(data.default_contact_phone) ||
    adminFallbackPhone
  );
}

async function loadListing(db: Db, listingId: string): Promise<ListingRow | null> {
  const { data, error } = await db
    .from("listings")
    .select(
      "id,title,district,address,price,area,width,length,floors,bedrooms,bathrooms,description,images,status",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ListingRow | null) ?? null;
}

async function loadEligibleGroups(
  db: Db,
  accountId: string,
): Promise<FacebookGroupRow[]> {
  /*
   * Nhóm quét từ Facebook có thể:
   * - thuộc đúng facebook_account_id;
   * - là nhóm dùng chung với facebook_account_id = null;
   * - hoặc là dữ liệu cũ đã lưu bằng account khác.
   *
   * Vì vậy:
   * 1. Ưu tiên nhóm đúng tài khoản + nhóm dùng chung.
   * 2. Nếu kết quả rỗng, fallback toàn bộ nhóm đang hoạt động.
   * Không để next-job báo 0/10 khi bảng facebook_groups thực tế có dữ liệu.
   */
  const modernColumns =
    "id,name,url,district,districts,category,priority,is_active,group_status,muted_until,daily_post_limit,allowed_start_hour,allowed_end_hour";

  const legacyColumns =
    "id,name,url,district,category,priority,is_active,group_status,muted_until,daily_post_limit,allowed_start_hour,allowed_end_hour";

  async function queryGroups(input: {
    columns: string;
    accountScoped: boolean;
  }): Promise<any> {
    let query = db
      .from("facebook_groups")
      .select(input.columns)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(1000);

    if (input.accountScoped) {
      query = query.or(
        `facebook_account_id.eq.${accountId},facebook_account_id.is.null`,
      );
    }

    return query;
  }

  let result: any = await queryGroups({
    columns: modernColumns,
    accountScoped: true,
  });

  if (result.error?.message?.includes("facebook_account_id")) {
    result = await queryGroups({
      columns: modernColumns,
      accountScoped: false,
    });
  }

  if (result.error?.message?.includes("districts")) {
    result = await queryGroups({
      columns: legacyColumns,
      accountScoped: true,
    });

    if (result.error?.message?.includes("facebook_account_id")) {
      result = await queryGroups({
        columns: legacyColumns,
        accountScoped: false,
      });
    }
  }

  if (result.error) throw new Error(result.error.message);

  /*
   * Trường hợp query đúng account chạy thành công nhưng trả 0 dòng:
   * dùng toàn bộ nhóm hoạt động để tương thích dữ liệu đã có từ trước.
   */
  if (!Array.isArray(result.data) || result.data.length === 0) {
    result = await queryGroups({
      columns: modernColumns,
      accountScoped: false,
    });

    if (result.error?.message?.includes("districts")) {
      result = await queryGroups({
        columns: legacyColumns,
        accountScoped: false,
      });
    }

    if (result.error) throw new Error(result.error.message);
  }

  const rawGroups = (
    (result.data ?? []) as unknown as FacebookGroupRow[]
  );

  /*
   * facebook_groups trên web đã được Admin bật bằng is_active=true.
   * Không tiếp tục loại nhóm theo group_status, muted_until hoặc khung giờ,
   * vì dữ liệu quét cũ có thể chứa giá trị không đồng nhất và làm toàn bộ
   * danh sách bị loại thành 0/10 dù nhóm vẫn đang hoạt động trên web.
   */
  const eligible = rawGroups.filter((group) => {
    const normalizedName = normalizeGroupName(group.name);

    return Boolean(
      group.id &&
        group.name &&
        group.url &&
        group.is_active !== false &&
        normalizedName &&
        normalizedName !== "xem nhom" &&
        normalizedName !== "mo nhom" &&
        normalizedName !== "open group" &&
        normalizedName !== "view group",
    );
  });

  const missingUrl = rawGroups.filter(
    (group) => group.id && group.name && !group.url,
  ).length;

  const invalidName = rawGroups.filter((group) => {
    const normalizedName = normalizeGroupName(group.name);
    return (
      normalizedName === "xem nhom" ||
      normalizedName === "mo nhom" ||
      normalizedName === "open group" ||
      normalizedName === "view group"
    );
  }).length;

  console.log(
    `[NEXT-JOB GROUP SOURCE] DB=${rawGroups.length} | dùng=${eligible.length} | thiếu URL=${missingUrl} | tên lỗi=${invalidName}`,
  );

  return eligible;
}

function canonicalDistrict(value: unknown): string {
  const normalized = normalizeText(value)
    .replace(/\bquan\b/g, "q")
    .replace(/\bq\s*(\d+)\b/g, "q$1")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Array<[RegExp, string]> = [
    [/\bq1\b|\bquan 1\b/, "q1"],
    [/\bq2\b|\bquan 2\b|\bthu duc\b|\bthanh pho thu duc\b/, "q2"],
    [/\bq3\b|\bquan 3\b/, "q3"],
    [/\bq4\b|\bquan 4\b/, "q4"],
    [/\bq5\b|\bquan 5\b/, "q5"],
    [/\bq6\b|\bquan 6\b/, "q6"],
    [/\bq7\b|\bquan 7\b/, "q7"],
    [/\bq8\b|\bquan 8\b/, "q8"],
    [/\bq9\b|\bquan 9\b/, "q9"],
    [/\bq10\b|\bquan 10\b/, "q10"],
    [/\bq11\b|\bquan 11\b/, "q11"],
    [/\bq12\b|\bquan 12\b/, "q12"],
    [/\bbinh thanh\b/, "binh thanh"],
    [/\bphu nhuan\b/, "phu nhuan"],
    [/\btan binh\b/, "tan binh"],
    [/\btan phu\b/, "tan phu"],
    [/\bbinh tan\b/, "binh tan"],
    [/\bgo vap\b/, "go vap"],
    [/\bbinh chanh\b/, "binh chanh"],
    [/\bhoc mon\b/, "hoc mon"],
    [/\bcu chi\b/, "cu chi"],
    [/\bnha be\b/, "nha be"],
    [/\bcan gio\b/, "can gio"],
  ];

  for (const [pattern, key] of aliases) {
    if (pattern.test(normalized)) return key;
  }

  return normalized;
}

const ADJACENT_DISTRICTS: Record<string, string[]> = {
  q1: ["q3", "q4", "q5", "binh thanh"],
  q2: ["q1", "q4", "q7", "binh thanh", "q9"],
  q3: ["q1", "q10", "phu nhuan", "tan binh"],
  q4: ["q1", "q2", "q5", "q7", "q8"],
  q5: ["q1", "q4", "q6", "q8", "q10", "q11"],
  q6: ["q5", "q8", "q11", "binh tan"],
  q7: ["q2", "q4", "q8", "nha be"],
  q8: ["q4", "q5", "q6", "q7", "binh chanh"],
  q9: ["q2", "thu duc"],
  q10: ["q3", "q5", "q11", "tan binh"],
  q11: ["q5", "q6", "q10", "tan phu"],
  q12: ["go vap", "hoc mon", "tan binh", "thu duc"],
  "binh thanh": ["q1", "q2", "phu nhuan", "go vap"],
  "phu nhuan": ["q3", "binh thanh", "go vap", "tan binh"],
  "tan binh": ["q3", "q10", "q11", "q12", "phu nhuan", "go vap", "tan phu"],
  "tan phu": ["q11", "q12", "tan binh", "binh tan"],
  "binh tan": ["q6", "q8", "q11", "tan phu", "binh chanh"],
  "go vap": ["q12", "binh thanh", "phu nhuan", "tan binh"],
  "binh chanh": ["q7", "q8", "binh tan", "nha be"],
  "hoc mon": ["q12", "cu chi", "binh chanh"],
  "nha be": ["q7", "binh chanh", "can gio"],
};

function extractDistrictKeysFromText(value: unknown): string[] {
  const source = normalizeText(value);
  const keys = new Set<string>();

  const directPatterns: Array<[RegExp, string]> = [
    [/\b(?:q|quan)\s*1\b/g, "q1"],
    [/\b(?:q|quan)\s*2\b|\bthu duc\b|\bthanh pho thu duc\b/g, "q2"],
    [/\b(?:q|quan)\s*3\b/g, "q3"],
    [/\b(?:q|quan)\s*4\b/g, "q4"],
    [/\b(?:q|quan)\s*5\b/g, "q5"],
    [/\b(?:q|quan)\s*6\b/g, "q6"],
    [/\b(?:q|quan)\s*7\b/g, "q7"],
    [/\b(?:q|quan)\s*8\b/g, "q8"],
    [/\b(?:q|quan)\s*9\b/g, "q9"],
    [/\b(?:q|quan)\s*10\b/g, "q10"],
    [/\b(?:q|quan)\s*11\b/g, "q11"],
    [/\b(?:q|quan)\s*12\b/g, "q12"],
    [/\bbinh thanh\b/g, "binh thanh"],
    [/\bphu nhuan\b/g, "phu nhuan"],
    [/\btan binh\b/g, "tan binh"],
    [/\btan phu\b/g, "tan phu"],
    [/\bbinh tan\b/g, "binh tan"],
    [/\bgo vap\b/g, "go vap"],
    [/\bbinh chanh\b/g, "binh chanh"],
    [/\bhoc mon\b/g, "hoc mon"],
    [/\bcu chi\b/g, "cu chi"],
    [/\bnha be\b/g, "nha be"],
    [/\bcan gio\b/g, "can gio"],
  ];

  for (const [pattern, key] of directPatterns) {
    if (pattern.test(source)) keys.add(key);
  }

  /*
   * Nhận diện danh sách quận rút gọn:
   * "các quận 1,3,5,10", "quận 1 3 5 10".
   * Không coi mọi số đứng riêng là tên quận.
   */
  const listMatches = source.matchAll(
    /\b(?:cac\s+)?quan\s+((?:\d{1,2}(?:\s*[,;/|-]\s*|\s+)){1,11}\d{1,2})\b/g,
  );

  for (const match of listMatches) {
    const numbers = String(match[1] ?? "").match(/\d{1,2}/g) ?? [];

    for (const number of numbers) {
      const parsed = Number(number);
      if (parsed >= 1 && parsed <= 12) keys.add(`q${parsed}`);
    }
  }

  return [...keys];
}

function groupDistrictKeys(group: FacebookGroupRow): string[] {
  const structured = [
    group.district,
    ...(Array.isArray(group.districts) ? group.districts : []),
  ]
    .map(canonicalDistrict)
    .filter(Boolean);

  const fromName = extractDistrictKeysFromText(group.name);
  const fromCategory = extractDistrictKeysFromText(group.category);

  return Array.from(
    new Set([
      ...structured,
      ...fromName,
      ...fromCategory,
    ]),
  );
}

function isCitywideGroup(group: FacebookGroupRow): boolean {
  const source = normalizeText(
    [
      group.name,
      group.category,
      group.district,
      ...(Array.isArray(group.districts) ? group.districts : []),
    ].join(" "),
  );

  const broadCityToken = [
    "tp hcm",
    "tphcm",
    "thanh pho ho chi minh",
    "ho chi minh",
    "sai gon",
    "toan tp",
    "toan thanh pho",
    "toan hcm",
    "all district",
    "citywide",
  ].some((token) => source.includes(token));

  if (!broadCityToken) return false;

  /*
   * Có chữ TP.HCM nhưng đồng thời chỉ rõ một hoặc nhiều quận
   * thì không phải nhóm toàn thành phố.
   */
  return groupDistrictKeys(group).length === 0;
}

function categoryScore(
  group: FacebookGroupRow,
  categories: string[],
): number {
  const source = normalizeText(`${group.name} ${group.category ?? ""}`);
  return categories.some((category) =>
    source.includes(normalizeText(category)),
  )
    ? 0
    : 1;
}

async function chooseGroups(
  db: Db,
  accountId: string,
  listing: ListingRow,
): Promise<FacebookGroupRow[]> {
  const targetDistrict = canonicalDistrict(listing.district);
  if (!targetDistrict) return [];

  const categories = detectCategories(listing);
  const groups = uniqueGroupsByFacebookName(
    await loadEligibleGroups(db, accountId),
  );

  const adjacent = new Set(
    ADJACENT_DISTRICTS[targetDistrict] ?? [],
  );

  const sameDistrict: FacebookGroupRow[] = [];
  const citywide: FacebookGroupRow[] = [];
  const adjacentDistrict: FacebookGroupRow[] = [];

  for (const group of groups) {
    const keys = groupDistrictKeys(group);

    if (keys.includes(targetDistrict)) {
      sameDistrict.push(group);
      continue;
    }

    if (isCitywideGroup(group)) {
      citywide.push(group);
      continue;
    }

    if (keys.some((key) => adjacent.has(key))) {
      adjacentDistrict.push(group);
    }
  }

  const sortBucket = (items: FacebookGroupRow[]) =>
    [...items].sort((a, b) => {
      const categoryDifference =
        categoryScore(a, categories) - categoryScore(b, categories);

      if (categoryDifference !== 0) return categoryDifference;

      return (
        Number(a.priority ?? 100) -
        Number(b.priority ?? 100)
      );
    });

  const selected: FacebookGroupRow[] = [];
  const usedNames = new Set<string>();
  const usedUrls = new Set<string>();

  const append = (items: FacebookGroupRow[]) => {
    for (const group of sortBucket(items)) {
      const nameKey = normalizeGroupName(group.name);
      const urlKey = String(group.url ?? "")
        .trim()
        .replace(/\/+$/, "")
        .toLowerCase();

      if (!nameKey || !urlKey) continue;
      if (usedNames.has(nameKey) || usedUrls.has(urlKey)) continue;

      usedNames.add(nameKey);
      usedUrls.add(urlKey);
      selected.push(group);

      if (selected.length >= TOTAL_GROUPS) return;
    }
  };

  // Bắt buộc: đúng quận → toàn TP.HCM → quận sát bên.
  append(sameDistrict);
  if (selected.length < TOTAL_GROUPS) append(citywide);
  if (selected.length < TOTAL_GROUPS) append(adjacentDistrict);

  console.log(
    `[NEXT-JOB GROUPS] ${listing.district}: ` +
      `${sameDistrict.length} đúng quận | ` +
      `${citywide.length} toàn TP | ` +
      `${adjacentDistrict.length} quận sát bên | ` +
      `chọn ${selected.length}/${TOTAL_GROUPS}`,
  );

  return selected.slice(0, TOTAL_GROUPS);
}

async function removeLegacySiblingJobs(
  db: Db,
  batchId: string | null,
  keepJobId: string,
): Promise<void> {
  if (!batchId) return;

  const { error } = await db
    .from("social_post_jobs")
    .delete()
    .eq("batch_id", batchId)
    .neq("id", keepJobId)
    .in("status", [
      "pending",
      "processing",
      "failed",
      "cancelled",
      "pending_approval",
    ]);

  if (error) {
    throw new Error(
      `Không dọn được job trùng của batch ${batchId}: ${error.message}`,
    );
  }
}

async function findExistingBatchGroupJob(
  db: Db,
  batchId: string,
  groupId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await db
    .from("social_post_jobs")
    .select("id,status")
    .eq("batch_id", batchId)
    .eq("facebook_group_id", groupId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data
    ? {
        id: String(data.id),
        status: String(data.status ?? ""),
      }
    : null;
}

async function cancelSiblingJobs(
  db: Db,
  job: JobRow,
): Promise<void> {
  if (!job.batch_id) return;

  /*
   * Dữ liệu cũ từng tạo 10 job cho cùng một batch.
   * Worker hiện đăng chéo 1 lần vào đủ 10 nhóm, nên 9 job còn lại phải hủy,
   * nếu không bot sẽ đăng lặp lại cùng một tin 10 lần.
   */
  const { error } = await db
    .from("social_post_jobs")
    .update({
      status: "cancelled",
      error_code: "MERGED_INTO_CROSSPOST_JOB",
      last_error: "Đã gộp vào một job đăng chéo 1 nhóm chính + 9 nhóm phụ",
    })
    .eq("batch_id", job.batch_id)
    .neq("id", job.id)
    .in("status", ["pending", "processing"]);

  if (error) throw new Error(error.message);
}

async function claimPendingJob(input: {
  db: Db;
  accountId: string;
  defaultContactPhone: string;
}): Promise<Record<string, unknown> | null> {
  const { db, accountId, defaultContactPhone } = input;
  const now = new Date();

  const { data: candidates, error } = await db
    .from("social_post_jobs")
    .select(
      "id,batch_id,listing_id,facebook_group_id,facebook_account_id,content,scheduled_at,attempt_count,max_attempts,next_retry_at,facebook_groups(id,name,url,district)",
    )
    .eq("facebook_account_id", accountId)
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  console.log(
    `[NEXT-JOB] Tìm thấy ${(candidates ?? []).length} job pending đã tới giờ cho account ${accountId}`,
  );

  for (const raw of (candidates ?? []) as unknown as JobRow[]) {
    const listing = await loadListing(db, raw.listing_id);

    if (!listing) {
      await db
        .from("social_post_jobs")
        .update({
          status: "cancelled",
          error_code: "LISTING_NOT_FOUND",
          last_error: "Không tìm thấy tin đăng",
        })
        .eq("id", raw.id);
      continue;
    }

    if (isListingUnavailable(listing.status)) {
      await db
        .from("social_post_jobs")
        .update({
          status: "cancelled",
          error_code: "LISTING_UNAVAILABLE",
          last_error: "Tin đã cho thuê hoặc ngừng đăng",
        })
        .eq("listing_id", listing.id)
        .in("status", ["pending", "processing"]);

      if (raw.batch_id) {
        await db
          .from("social_post_batches")
          .update({ status: "cancelled" })
          .eq("id", raw.batch_id);
      }

      continue;
    }

    const groups = await chooseGroups(db, accountId, listing);

    if (groups.length !== TOTAL_GROUPS) {
      await db
        .from("social_post_jobs")
        .update({
          status: "failed",
          error_code: "NOT_ENOUGH_GROUPS",
          last_error: `Chỉ chọn được ${groups.length}/${TOTAL_GROUPS} nhóm`,
        })
        .eq("id", raw.id);

      if (raw.batch_id) {
        await db
          .from("social_post_batches")
          .update({ status: "failed" })
          .eq("id", raw.batch_id);
      }

      continue;
    }

    const currentPrimary = getSingleRelation(raw.facebook_groups);

    /*
     * Luôn lấy nhóm đầu tiên do chooseGroups xếp hạng.
     * Không giữ nhóm chính cũ nếu nó thuộc sai quận.
     */
    const primary = groups[0];

    const primaryNameKey = normalizeGroupName(primary.name);
    const extraGroups = groups
      .filter(
        (group) =>
          group.id !== primary.id &&
          normalizeGroupName(group.name) !== primaryNameKey,
      )
      .slice(0, EXTRA_GROUPS);

    const uniqueExtraNameCount = new Set(
      extraGroups.map((group) => normalizeGroupName(group.name)),
    ).size;

    if (
      extraGroups.length !== EXTRA_GROUPS ||
      uniqueExtraNameCount !== EXTRA_GROUPS
    ) {
      await db
        .from("social_post_jobs")
        .update({
          status: "failed",
          error_code: "DUPLICATE_GROUP_NAMES",
          last_error:
            `Không tạo được ${EXTRA_GROUPS} tên nhóm phụ duy nhất cho Facebook`,
        })
        .eq("id", raw.id);

      if (raw.batch_id) {
        await db
          .from("social_post_batches")
          .update({ status: "failed" })
          .eq("id", raw.batch_id);
      }

      continue;
    }

    const baseContent = buildBaseContent(listing);
    const finalized = finalizeFacebookContent({
      baseContent: baseContent || raw.content,
      listing,
      contactPhone: defaultContactPhone,
    });

    const attemptCount = Number(raw.attempt_count ?? 0);
    const maxAttempts = Number(raw.max_attempts ?? 3);

    if (attemptCount >= maxAttempts) {
      await db
        .from("social_post_jobs")
        .update({
          status: "failed",
          error_code: "MAX_ATTEMPTS_REACHED",
          last_error: "Đã vượt số lần thử tối đa",
        })
        .eq("id", raw.id);
      continue;
    }

    await removeLegacySiblingJobs(
      db,
      raw.batch_id,
      raw.id,
    );

    const { data: claimed, error: claimError } = await db
      .from("social_post_jobs")
      .update({
        status: "processing",
        facebook_group_id: primary.id,
        content: finalized.content,
        contact_phone_snapshot: defaultContactPhone || null,
        hashtags_snapshot: finalized.hashtags,
        attempt_count: attemptCount + 1,
        claimed_at: now.toISOString(),
        last_error: null,
        error_code: null,
        error_type: null,
      })
      .eq("id", raw.id)
      .eq("status", "pending")
      .select(
        "id,batch_id,listing_id,facebook_group_id,facebook_account_id,content,scheduled_at,attempt_count",
      )
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;

    await cancelSiblingJobs(db, {
      ...raw,
      id: String(claimed.id),
    });

    if (raw.batch_id) {
      await db
        .from("social_post_batches")
        .update({ status: "processing" })
        .eq("id", raw.batch_id)
        .in("status", ["pending", "processing"]);
    }

    return {
      ...claimed,
      group_url: primary.url,
      groupUrl: primary.url,
      group_name: primary.name,
      groupName: primary.name,
      extra_group_names: extraGroups.map((group) =>
        String(group.name ?? "").trim(),
      ),
      extraGroupNames: extraGroups.map((group) =>
        String(group.name ?? "").trim(),
      ),
      extra_group_ids: extraGroups.map((group) => group.id),
      extraGroupIds: extraGroups.map((group) => group.id),
      total_group_count: TOTAL_GROUPS,
      totalGroupCount: TOTAL_GROUPS,
      contactPhone: defaultContactPhone || null,
      hashtags: finalized.hashtags,
      listing,
      images: Array.isArray(listing.images) ? listing.images : [],
      primaryGroupWasChanged:
        Boolean(currentPrimary?.id) && currentPrimary?.id !== primary.id,
    };
  }

  return null;
}

async function repairLegacyActiveBatches(
  db: Db,
  accountId: string,
): Promise<number> {
  /*
   * Một số batch cũ được lưu với status = active trước khi constraint hiện tại
   * chỉ còn cho phép pending/processing/completed/cancelled/failed.
   * Chuyển các batch đó về pending trước khi lấy job.
   */
  const { data, error } = await db
    .from("social_post_batches")
    .update({ status: "pending" })
    .eq("facebook_account_id", accountId)
    .eq("status", "active")
    .select("id");

  if (error) {
    /*
     * Nếu không còn dữ liệu/schema cũ dùng active thì không làm hỏng next-job.
     * Các lỗi khác vẫn được ghi ra terminal để kiểm tra.
     */
    console.warn(
      "[NEXT-JOB] Không thể sửa batch active cũ:",
      error.message,
    );
    return 0;
  }

  const repaired = Array.isArray(data) ? data.length : 0;

  if (repaired > 0) {
    console.log(
      `[NEXT-JOB] Đã chuyển ${repaired} batch active cũ về pending`,
    );
  }

  return repaired;
}

async function materializeNextBatch(input: {
  db: Db;
  accountId: string;
  defaultContactPhone: string;
}): Promise<boolean> {
  const { db, accountId, defaultContactPhone } = input;
  const nowIso = new Date().toISOString();

  const { data: batches, error } = await db
    .from("social_post_batches")
    .select(
      "id,listing_id,facebook_account_id,status,contact_phone_snapshot,created_at",
    )
    .eq("facebook_account_id", accountId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  for (const batch of (batches ?? []) as unknown as BatchRow[]) {
    /*
     * Chỉ một request được quyền chuyển batch sang processing.
     * Request khác update 0 dòng và chuyển sang batch kế tiếp.
     */
    const { data: claimedBatch, error: claimBatchError } = await db
      .from("social_post_batches")
      .update({ status: "processing" })
      .eq("id", batch.id)
      .eq("status", "pending")
      .select("id,listing_id")
      .maybeSingle();

    if (claimBatchError) throw new Error(claimBatchError.message);
    if (!claimedBatch) continue;

    try {
      const listing = await loadListing(db, batch.listing_id);

      if (!listing) {
        await db
          .from("social_post_batches")
          .update({ status: "cancelled" })
          .eq("id", batch.id);
        continue;
      }

      if (isListingUnavailable(listing.status)) {
        await db
          .from("social_post_batches")
          .update({ status: "cancelled" })
          .eq("id", batch.id);
        continue;
      }

      const groups = await chooseGroups(db, accountId, listing);

      if (groups.length !== TOTAL_GROUPS) {
        await db
          .from("social_post_batches")
          .update({ status: "failed" })
          .eq("id", batch.id);
        continue;
      }

      const primary = groups[0];
      const baseContent = buildBaseContent(listing);
      const finalized = finalizeFacebookContent({
        baseContent,
        listing,
        contactPhone: defaultContactPhone,
      });

      const existing = await findExistingBatchGroupJob(
        db,
        batch.id,
        primary.id,
      );

      if (existing) {
        if (existing.status === "posted") {
          await db
            .from("social_post_batches")
            .update({ status: "completed" })
            .eq("id", batch.id);

          return false;
        }

        await removeLegacySiblingJobs(
          db,
          batch.id,
          existing.id,
        );

        const { error: reuseError } = await db
          .from("social_post_jobs")
          .update({
            listing_id: listing.id,
            facebook_account_id: accountId,
            facebook_group_id: primary.id,
            content_version: 1,
            content: finalized.content,
            contact_phone_snapshot: defaultContactPhone || null,
            hashtags_snapshot: finalized.hashtags,
            scheduled_at: nowIso,
            status: "pending",
            attempt_count: 0,
            next_retry_at: null,
            claimed_at: null,
            last_error: null,
            error_code: null,
            error_type: null,
          })
          .eq("id", existing.id);

        if (reuseError) throw new Error(reuseError.message);

        console.log(
          `[NEXT-JOB] Tái sử dụng job ${existing.id} của batch ${batch.id}`,
        );

        return true;
      }

      const { error: insertError } = await db
        .from("social_post_jobs")
        .insert({
          batch_id: batch.id,
          listing_id: listing.id,
          facebook_account_id: accountId,
          facebook_group_id: primary.id,
          content_version: 1,
          content: finalized.content,
          contact_phone_snapshot: defaultContactPhone || null,
          hashtags_snapshot: finalized.hashtags,
          scheduled_at: nowIso,
          status: "pending",
        });

      if (insertError) {
        const duplicate =
          insertError.code === "23505" ||
          /duplicate|unique/i.test(insertError.message);

        if (!duplicate) throw new Error(insertError.message);

        console.warn(
          `[NEXT-JOB] Job vừa được request khác tạo cho batch ${batch.id}`,
        );
      }

      return true;
    } catch (materializeError) {
      await db
        .from("social_post_batches")
        .update({ status: "failed" })
        .eq("id", batch.id)
        .eq("status", "processing");

      throw materializeError;
    }
  }

  return false;
}

export async function GET(request: Request) {
  console.log("[NEXT-JOB] Route active-groups-only-v14 đang chạy");

  try {
    const accountId = new URL(request.url).searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Thiếu accountId" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();
    const now = new Date();

    const { data: account, error: accountError } = await db
      .from("facebook_accounts")
      .select(
        "id,license_id,broker_profile_id,is_active,status,health_status,daily_post_limit,hourly_post_limit,paused_until",
      )
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json(
        { error: accountError.message },
        { status: 500 },
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản Facebook" },
        { status: 404 },
      );
    }

    if (
      !account.is_active ||
      account.status !== "active" ||
      !["healthy", "warming_up"].includes(account.health_status)
    ) {
      return NextResponse.json({
        job: null,
        blocked: true,
        reason: `Tài khoản đang ở trạng thái ${account.health_status}`,
      });
    }

    if (account.paused_until && new Date(account.paused_until) > now) {
      return NextResponse.json({
        job: null,
        blocked: true,
        reason: "Tài khoản đang tạm dừng",
        pausedUntil: account.paused_until,
      });
    }

    const defaultContactPhone = await getDefaultPhone(db, account);

    console.log(
      `[NEXT-JOB] account=${accountId} | phone=${defaultContactPhone}`,
    );


    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const hourStart = new Date(now.getTime() - 60 * 60 * 1000);

    const [{ count: postedToday }, { count: postedLastHour }] =
      await Promise.all([
        db
          .from("social_post_history")
          .select("id", { count: "exact", head: true })
          .eq("facebook_account_id", accountId)
          .gte("posted_at", dayStart.toISOString()),
        db
          .from("social_post_history")
          .select("id", { count: "exact", head: true })
          .eq("facebook_account_id", accountId)
          .gte("posted_at", hourStart.toISOString()),
      ]);

    if ((postedToday ?? 0) >= Number(account.daily_post_limit ?? 20)) {
      return NextResponse.json({
        job: null,
        blocked: true,
        reason: "Đã đạt giới hạn bài hôm nay",
      });
    }

    if ((postedLastHour ?? 0) >= Number(account.hourly_post_limit ?? 5)) {
      return NextResponse.json({
        job: null,
        blocked: true,
        reason: "Đã đạt giới hạn bài trong 1 giờ",
      });
    }

    /*
     * 1. Ưu tiên lấy job pending đã có.
     * 2. Nếu chưa có job, lấy một batch thô và tạo đúng một crosspost job.
     * 3. Claim lại job vừa tạo và trả cho worker.
     */
    let job = await claimPendingJob({
      db,
      accountId,
      defaultContactPhone,
    });

    if (!job) {
      const created = await materializeNextBatch({
        db,
        accountId,
        defaultContactPhone,
      });

      if (created) {
        job = await claimPendingJob({
          db,
          accountId,
          defaultContactPhone,
        });
      }
    }

    if (job) {
      console.log(
        `[NEXT-JOB] Đã trả job ${String(job.id ?? "")}`,
      );
    } else {
      console.log("[NEXT-JOB] Chưa có job phù hợp");
    }

    return NextResponse.json({ job: job ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không lấy được job Facebook",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accountId = String(
    body?.accountId ||
      body?.facebookAccountId ||
      body?.facebook_account_id ||
      "",
  ).trim();

  const url = new URL(request.url);
  if (accountId) url.searchParams.set("accountId", accountId);

  return GET(
    new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    }),
  );
}
