import crypto from "node:crypto";

export const MAX_GROUPS_PER_CROSSPOST = 10;
export const MIN_DELAY_MINUTES = 1;
export const MAX_DELAY_MINUTES = 6;
export const MIN_REPEAT_HOURS = 12;
export const MAX_REPEAT_HOURS = 16;

export type GroupCandidate = {
  id: string;
  name?: string | null;

  // Hỗ trợ cả cấu trúc cũ lẫn cấu trúc DB hiện tại.
  district?: string | null;
  districts?: string[] | null;

  category?: string | null;
  priority?: number | null;
};

export type FacebookAccountSchedule = {
  postingMode?: string | null;
  posting_mode?: string | null;

  scheduleEnabled?: boolean | null;
  schedule_enabled?: boolean | null;

  startTime?: string | null;
  start_time?: string | null;
  scheduleStart?: string | null;
  schedule_start?: string | null;

  endTime?: string | null;
  end_time?: string | null;
  scheduleEnd?: string | null;
  schedule_end?: string | null;

  timezone?: string | null;
};

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function addRandomMinutes(
  from: Date,
  min = MIN_DELAY_MINUTES,
  max = MAX_DELAY_MINUTES,
): Date {
  return new Date(from.getTime() + randomInt(min, max) * 60_000);
}

export function addRandomRepeatHours(from: Date): Date {
  const minutes = randomInt(
    MIN_REPEAT_HOURS * 60,
    MAX_REPEAT_HOURS * 60,
  );

  return new Date(from.getTime() + minutes * 60_000);
}

export function contentHash(content: string): string {
  return crypto
    .createHash("sha256")
    .update(String(content || "").trim().replace(/\s+/g, " "))
    .digest("hex");
}

const ADJACENT_DISTRICTS: Record<string, string[]> = {
  "quan 1": [
    "quan 3",
    "quan 4",
    "quan 5",
    "binh thanh",
    "phu nhuan",
  ],
  "quan 2": [
    "quan 1",
    "quan 7",
    "quan 9",
    "binh thanh",
    "thu duc",
  ],
  "thu duc": [
    "quan 2",
    "quan 9",
    "binh thanh",
    "go vap",
  ],
  "quan 3": [
    "quan 1",
    "quan 5",
    "quan 10",
    "phu nhuan",
    "tan binh",
  ],
  "quan 4": [
    "quan 1",
    "quan 5",
    "quan 7",
    "quan 8",
  ],
  "quan 5": [
    "quan 1",
    "quan 3",
    "quan 4",
    "quan 6",
    "quan 8",
    "quan 10",
    "quan 11",
  ],
  "quan 6": [
    "quan 5",
    "quan 8",
    "quan 11",
    "binh tan",
    "tan phu",
  ],
  "quan 7": [
    "quan 2",
    "quan 4",
    "quan 8",
    "nha be",
  ],
  "quan 8": [
    "quan 4",
    "quan 5",
    "quan 6",
    "quan 7",
    "binh chanh",
  ],
  "quan 9": ["quan 2", "thu duc"],
  "quan 10": [
    "quan 3",
    "quan 5",
    "quan 11",
    "tan binh",
  ],
  "quan 11": [
    "quan 5",
    "quan 6",
    "quan 10",
    "tan binh",
    "tan phu",
  ],
  "quan 12": ["go vap", "tan binh", "hoc mon"],
  "binh thanh": [
    "quan 1",
    "quan 2",
    "phu nhuan",
    "go vap",
    "thu duc",
  ],
  "phu nhuan": [
    "quan 1",
    "quan 3",
    "binh thanh",
    "tan binh",
    "go vap",
  ],
  "tan binh": [
    "quan 3",
    "quan 10",
    "quan 11",
    "quan 12",
    "phu nhuan",
    "go vap",
    "tan phu",
  ],
  "tan phu": [
    "quan 6",
    "quan 11",
    "tan binh",
    "binh tan",
  ],
  "go vap": [
    "quan 12",
    "binh thanh",
    "phu nhuan",
    "tan binh",
    "thu duc",
  ],
  "binh tan": ["quan 6", "tan phu", "binh chanh"],
  "hoc mon": ["quan 12", "binh chanh", "cu chi"],
  "nha be": ["quan 7", "binh chanh"],
  "binh chanh": [
    "quan 8",
    "binh tan",
    "hoc mon",
    "nha be",
  ],
  "cu chi": ["hoc mon"],
  "can gio": ["nha be"],
};

const NAMED_DISTRICTS: Record<string, string[]> = {
  "thu duc": [
    "thu duc",
    "tp thu duc",
    "thanh pho thu duc",
  ],
  "binh thanh": ["binh thanh"],
  "phu nhuan": ["phu nhuan"],
  "tan binh": ["tan binh"],
  "tan phu": ["tan phu"],
  "go vap": ["go vap"],
  "binh tan": ["binh tan"],
  "hoc mon": ["hoc mon"],
  "nha be": ["nha be"],
  "binh chanh": ["binh chanh"],
  "cu chi": ["cu chi"],
  "can gio": ["can gio"],
};

function stripMarks(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeText(value: unknown): string {
  return stripMarks(String(value ?? ""))
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDistrict(
  value: string | null | undefined,
): string {
  let normalized = normalizeText(value)
    .replace(/\b(?:tp|thanh pho)\s*hcm\b/g, "")
    .replace(/\bho chi minh\b/g, "")
    .replace(/^[,;|/_\\\-\s]+|[,;|/_\\\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const numbered = normalized.match(
    /^(?:q|quan)?\s*(\d{1,2})$/,
  );

  if (numbered) {
    return `quan ${Number(numbered[1])}`;
  }

  normalized = normalized
    .replace(/^(?:q|quan|huyen)\s+/, "")
    .replace(/^(?:tp|thanh pho)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tự đọc quận trực tiếp từ tên nhóm.
 *
 * Ví dụ:
 * - "Cho thuê nhà Quận 10" -> ["quan 10"]
 * - "Bình Thạnh - Phú Nhuận - Q1 - Q3"
 *   -> ["binh thanh", "phu nhuan", "quan 1", "quan 3"]
 * - "Nhà cho thuê TPHCM" -> []
 */
export function inferDistrictsFromName(
  name: string | null | undefined,
): string[] {
  const text = normalizeText(name)
    .replace(/[^a-z0-9,;/|+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return [];
  }

  const found = new Set<string>();

  // Q1, Q.1, Quận 1, Quan 1.
  const explicitNumberPattern =
    /\b(?:q|quan)\s*(\d{1,2})\b/g;

  for (const match of text.matchAll(explicitNumberPattern)) {
    const number = Number(match[1]);

    if (number >= 1 && number <= 12) {
      found.add(`quan ${number}`);
    }
  }

  // Dạng "quận 1,3,10" hoặc "q 1-3-10".
  const districtListPattern =
    /\b(?:q|quan)\s*(\d{1,2}(?:\s*[,;/|+\-]\s*\d{1,2})+)\b/g;

  for (const match of text.matchAll(districtListPattern)) {
    const numbers = match[1].match(/\d{1,2}/g) ?? [];

    for (const rawNumber of numbers) {
      const number = Number(rawNumber);

      if (number >= 1 && number <= 12) {
        found.add(`quan ${number}`);
      }
    }
  }

  for (const [districtId, aliases] of Object.entries(
    NAMED_DISTRICTS,
  )) {
    for (const alias of aliases) {
      const pattern = new RegExp(
        `(?:^|[^a-z0-9])${escapeRegExp(alias)}(?:$|[^a-z0-9])`,
        "i",
      );

      if (pattern.test(text)) {
        found.add(districtId);
        break;
      }
    }
  }

  return Array.from(found);
}

function parseExplicitDistricts(
  group: GroupCandidate,
): string[] {
  const values: string[] = [];

  if (Array.isArray(group.districts)) {
    values.push(...group.districts.map(String));
  }

  if (group.district) {
    values.push(
      ...String(group.district)
        .split(/[,;/|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  return Array.from(
    new Set(
      values
        .map(normalizeDistrict)
        .filter(Boolean),
    ),
  );
}

/**
 * Cột district/districts có dữ liệu thì dùng dữ liệu đó.
 * Nếu cả hai đều NULL/rỗng thì tự đọc từ tên nhóm.
 */
function effectiveDistrictsOf(
  group: GroupCandidate,
): string[] {
  const explicit = parseExplicitDistricts(group);

  if (explicit.length > 0) {
    return explicit;
  }

  return inferDistrictsFromName(group.name);
}

function normalizeCategory(
  value: string | null | undefined,
): string {
  return stripMarks(String(value || "general"))
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");
}

function isWholeHouse(category: string): boolean {
  return [
    "whole-house",
    "wholehouse",
    "nha-nguyen-can",
    "house-rental",
  ].includes(category);
}

function isGeneral(category: string): boolean {
  return [
    "general",
    "rental",
    "cho-thue",
    "bat-dong-san",
  ].includes(category);
}

function categoryScore(
  groupCategory: string | null | undefined,
  listingCategories: Set<string>,
): number {
  const category = normalizeCategory(groupCategory);

  if (listingCategories.has(category)) {
    return 0;
  }

  if (isWholeHouse(category)) {
    return 1;
  }

  if (isGeneral(category)) {
    return 2;
  }

  return 3;
}

function sortGroups(
  groups: GroupCandidate[],
  listingCategories: Set<string>,
): GroupCandidate[] {
  return [...groups].sort((a, b) => {
    const byCategory =
      categoryScore(a.category, listingCategories) -
      categoryScore(b.category, listingCategories);

    if (byCategory !== 0) {
      return byCategory;
    }

    return (
      Number(a.priority ?? 100) -
      Number(b.priority ?? 100)
    );
  });
}

function uniqueById(
  groups: GroupCandidate[],
): GroupCandidate[] {
  const seen = new Set<string>();

  return groups.filter((group) => {
    if (!group.id || seen.has(group.id)) {
      return false;
    }

    seen.add(group.id);
    return true;
  });
}

/**
 * Thứ tự chọn nhóm:
 * 1. Nhóm chỉ đúng một quận và đúng quận của tin.
 * 2. Nhóm nhiều quận nhưng có chứa đúng quận của tin.
 * 3. Nhóm tổng hợp toàn TP.
 * 4. Nhóm quận giáp ranh.
 *
 * Không lấy nhóm chỉ thuộc một quận khác làm nhóm chính.
 */
export function selectCrosspostGroups(
  groups: GroupCandidate[],
  district: string,
  listingCategories: string[],
): GroupCandidate[] {
  const targetDistrict = normalizeDistrict(district);

  if (!targetDistrict) {
    return [];
  }

  const categories = new Set(
    (listingCategories ?? [])
      .map(normalizeCategory)
      .filter(Boolean),
  );

  const analyzed = groups.map((group) => ({
    group,
    effectiveDistricts: effectiveDistrictsOf(group),
  }));

  const exactSingleDistrictGroups = sortGroups(
    analyzed
      .filter(
        ({ effectiveDistricts }) =>
          effectiveDistricts.length === 1 &&
          effectiveDistricts[0] === targetDistrict,
      )
      .map(({ group }) => group),
    categories,
  );

  const exactMultiDistrictGroups = sortGroups(
    analyzed
      .filter(
        ({ effectiveDistricts }) =>
          effectiveDistricts.length > 1 &&
          effectiveDistricts.includes(targetDistrict),
      )
      .map(({ group }) => group),
    categories,
  );

  const citywideGroups = sortGroups(
    analyzed
      .filter(
        ({ effectiveDistricts }) =>
          effectiveDistricts.length === 0,
      )
      .map(({ group }) => group),
    categories,
  );

  const adjacentDistricts =
    ADJACENT_DISTRICTS[targetDistrict] ?? [];

  const adjacentGroups = sortGroups(
    analyzed
      .filter(
        ({ effectiveDistricts }) =>
          !effectiveDistricts.includes(targetDistrict) &&
          effectiveDistricts.some((districtId) =>
            adjacentDistricts.includes(districtId),
          ),
      )
      .map(({ group }) => group),
    categories,
  );

  return uniqueById([
    ...exactSingleDistrictGroups,
    ...exactMultiDistrictGroups,
    ...citywideGroups,
    ...adjacentGroups,
  ]).slice(0, MAX_GROUPS_PER_CROSSPOST);
}

export function buildSchedule(
  startAt: Date,
  count: number,
  minMinutes = MIN_DELAY_MINUTES,
  maxMinutes = MAX_DELAY_MINUTES,
): Date[] {
  const result: Date[] = [];
  let cursor = new Date(startAt);

  const safeMin = Math.max(0, Number(minMinutes) || 0);
  const safeMax = Math.max(safeMin, Number(maxMinutes) || 0);

  for (let index = 0; index < count; index += 1) {
    if (index > 0 && safeMax > 0) {
      cursor = addRandomMinutes(
        cursor,
        safeMin,
        safeMax,
      );
    }

    result.push(new Date(cursor));
  }

  return result;
}

function getScheduleMode(
  schedule: FacebookAccountSchedule,
): string {
  return String(
    schedule.postingMode ??
      schedule.posting_mode ??
      "live",
  )
    .toLowerCase()
    .trim();
}

function getScheduleEnabled(
  schedule: FacebookAccountSchedule,
): boolean {
  return Boolean(
    schedule.scheduleEnabled ??
      schedule.schedule_enabled ??
      false,
  );
}

function getScheduleStart(
  schedule: FacebookAccountSchedule,
): string {
  return String(
    schedule.startTime ??
      schedule.start_time ??
      schedule.scheduleStart ??
      schedule.schedule_start ??
      "00:00",
  );
}

function getScheduleEnd(
  schedule: FacebookAccountSchedule,
): string {
  return String(
    schedule.endTime ??
      schedule.end_time ??
      schedule.scheduleEnd ??
      schedule.schedule_end ??
      "23:59",
  );
}

function parseTimeToMinutes(value: string): number {
  const match = String(value || "").match(
    /^(\d{1,2}):(\d{2})/,
  );

  if (!match) {
    return 0;
  }

  const hour = Math.min(
    23,
    Math.max(0, Number(match[1])),
  );

  const minute = Math.min(
    59,
    Math.max(0, Number(match[2])),
  );

  return hour * 60 + minute;
}

function vietnamDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const vietnamDate = new Date(
    date.getTime() + 7 * 60 * 60 * 1000,
  );

  return {
    year: vietnamDate.getUTCFullYear(),
    month: vietnamDate.getUTCMonth(),
    day: vietnamDate.getUTCDate(),
    hour: vietnamDate.getUTCHours(),
    minute: vietnamDate.getUTCMinutes(),
  };
}

function vietnamLocalToUtc(
  year: number,
  month: number,
  day: number,
  minutesOfDay: number,
): Date {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      hour - 7,
      minute,
      0,
      0,
    ),
  );
}

/**
 * Nick LIVE luôn được lấy job.
 * Nick Scheduled chỉ được lấy job trong khung giờ cấu hình.
 *
 * Hỗ trợ khung giờ qua đêm, ví dụ 20:00 -> 02:00.
 */
export function isInsideAccountWindow(
  now: Date,
  schedule: FacebookAccountSchedule,
): boolean {
  const mode = getScheduleMode(schedule);

  if (mode === "live") {
    return true;
  }

  if (!getScheduleEnabled(schedule)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(
    getScheduleStart(schedule),
  );

  const endMinutes = parseTimeToMinutes(
    getScheduleEnd(schedule),
  );

  const parts = vietnamDateParts(now);
  const currentMinutes =
    parts.hour * 60 + parts.minute;

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return (
      currentMinutes >= startMinutes &&
      currentMinutes <= endMinutes
    );
  }

  return (
    currentMinutes >= startMinutes ||
    currentMinutes <= endMinutes
  );
}

/**
 * Trả về thời điểm bắt đầu khung đăng tiếp theo.
 */
export function nextWindowStart(
  now: Date,
  schedule: FacebookAccountSchedule,
): Date {
  const mode = getScheduleMode(schedule);

  if (mode === "live") {
    return new Date(now);
  }

  const startMinutes = parseTimeToMinutes(
    getScheduleStart(schedule),
  );

  const endMinutes = parseTimeToMinutes(
    getScheduleEnd(schedule),
  );

  const parts = vietnamDateParts(now);
  const currentMinutes =
    parts.hour * 60 + parts.minute;

  if (isInsideAccountWindow(now, schedule)) {
    return new Date(now);
  }

  if (startMinutes < endMinutes) {
    if (currentMinutes < startMinutes) {
      return vietnamLocalToUtc(
        parts.year,
        parts.month,
        parts.day,
        startMinutes,
      );
    }

    return vietnamLocalToUtc(
      parts.year,
      parts.month,
      parts.day + 1,
      startMinutes,
    );
  }

  // Khung giờ qua đêm.
  if (
    currentMinutes > endMinutes &&
    currentMinutes < startMinutes
  ) {
    return vietnamLocalToUtc(
      parts.year,
      parts.month,
      parts.day,
      startMinutes,
    );
  }

  return new Date(now);
}
