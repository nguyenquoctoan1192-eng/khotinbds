export type FollowUpPriority = "High" | "Medium" | "Low";

export type FollowUpEngineInput = {
  latest_activity?: {
    type?: unknown;
    content?: unknown;
    created_at?: unknown;
  } | null;
  days_since_last_activity?: unknown;
  status?: unknown;
};

export type FollowUpEngineResult = {
  next_follow_up_date: string | null;
  follow_up_reason: string;
  priority: FollowUpPriority;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const getDays = (value: unknown) => {
  const days = Number(value);

  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
};

const isClosedStatus = (status: unknown) =>
  /da chot|chot|huy|closed|cancel/.test(normalizeText(status));

export const getDaysSinceDate = (value: unknown) => {
  if (!value) {
    return 0;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

export const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

export const calculateFollowUp = (
  input: FollowUpEngineInput
): FollowUpEngineResult => {
  if (isClosedStatus(input.status)) {
    return {
      next_follow_up_date: null,
      follow_up_reason: "Lead đã kết thúc, chưa cần chăm sóc thêm.",
      priority: "Low",
    };
  }

  const days = getDays(input.days_since_last_activity);
  const today = new Date();

  if (days >= 7) {
    return {
      next_follow_up_date: toLocalDateString(today),
      follow_up_reason: "Lead đã 7 ngày chưa có tương tác, cần chăm sóc gấp để tránh nguội hẳn.",
      priority: "High",
    };
  }

  if (days >= 3) {
    return {
      next_follow_up_date: toLocalDateString(today),
      follow_up_reason: "Lead đã 3 ngày chưa có tương tác, nên follow-up ưu tiên cao.",
      priority: "High",
    };
  }

  if (days >= 1) {
    return {
      next_follow_up_date: toLocalDateString(today),
      follow_up_reason: "Lead đã 1 ngày chưa có tương tác, nên chăm sóc lại hôm nay.",
      priority: "Medium",
    };
  }

  return {
    next_follow_up_date: toLocalDateString(addDays(today, 1)),
    follow_up_reason: "Lead vừa có tương tác gần đây, có thể theo dõi và chăm lại vào ngày mai.",
    priority: "Low",
  };
};

export const getFollowUpPriorityRank = (priority: unknown) => {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;

  return 2;
};
