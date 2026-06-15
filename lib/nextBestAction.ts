export type NextAction =
  | "call_now"
  | "send_properties"
  | "ask_for_viewing"
  | "follow_up"
  | "wait";

export type NextActionPriority = "High" | "Medium" | "Low";

export type NextBestActionInput = {
  lead_score?: unknown;
  lead_temperature?: unknown;
  latest_activity?: {
    type?: unknown;
    content?: unknown;
    created_at?: unknown;
  } | null;
  days_since_last_activity?: unknown;
  status?: unknown;
  phone?: unknown;
};

export type NextBestActionResult = {
  next_action: NextAction;
  reason: string;
  priority: NextActionPriority;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const hasValue = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;

  return Boolean(value);
};

const getTemperature = (value: unknown, score: number) => {
  const normalized = normalizeText(value);

  if (normalized.includes("hot")) return "Hot";
  if (normalized.includes("warm")) return "Warm";
  if (normalized.includes("cold")) return "Cold";
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";

  return "Cold";
};

const getDays = (value: unknown) => {
  const days = Number(value);

  return Number.isFinite(days) && days >= 0 ? days : 0;
};

const getActivityText = (activity: NextBestActionInput["latest_activity"]) =>
  normalizeText([activity?.type, activity?.content].filter(Boolean).join(" "));

const isClosedStatus = (status: unknown) => {
  const normalized = normalizeText(status);

  return /da chot|chot|huy|closed|cancel/.test(normalized);
};

export const calculateNextBestAction = (
  input: NextBestActionInput
): NextBestActionResult => {
  const score = Number(input.lead_score || 0);
  const safeScore = Number.isFinite(score) ? score : 0;
  const temperature = getTemperature(input.lead_temperature, safeScore);
  const days = getDays(input.days_since_last_activity);
  const activityText = getActivityText(input.latest_activity);
  const hasPhone = hasValue(input.phone);

  if (isClosedStatus(input.status)) {
    return {
      next_action: "wait",
      reason: "Lead da o trang thai ket thuc, chua can tac dong them.",
      priority: "Low",
    };
  }

  if (!hasPhone && temperature === "Cold") {
    return {
      next_action: "wait",
      reason: "Lead lanh va chua co so dien thoai de lien he truc tiep.",
      priority: "Low",
    };
  }

  if (
    temperature === "Hot" &&
    (/ask_viewing|ask_viewing_time|di xem|xem nha|hen xem|muon xem/.test(activityText) ||
      /hot_lead|thich can|chot|can gap/.test(activityText))
  ) {
    return {
      next_action: "call_now",
      reason:
        days >= 3
          ? "Lead nong da co tin hieu xem nha va im lang tu 3 ngay tro len."
          : "Lead nong dang co tin hieu xem nha hoac chot nhanh.",
      priority: "High",
    };
  }

  if (/ask_photo|ask_video|co hinh|hinh thuc te|co video|clip|gui nha|gui can/.test(activityText)) {
    return {
      next_action: "send_properties",
      reason: "Khach dang muon xem hinh, video hoac can phu hop.",
      priority: temperature === "Hot" ? "High" : "Medium",
    };
  }

  if (/ask_availability|con can|chu cho thue|ask_price_negotiation|co bot|thuong luong/.test(activityText)) {
    return {
      next_action: "follow_up",
      reason: "Khach da hoi tinh trang can hoac gia, nen can bam sat de khong mat lead.",
      priority: temperature === "Hot" || days >= 2 ? "High" : "Medium",
    };
  }

  if (temperature === "Hot") {
    return {
      next_action: hasPhone ? "call_now" : "ask_for_viewing",
      reason: hasPhone
        ? "Lead nong va da co so dien thoai, nen goi ngay de chot lich."
        : "Lead nong nhung thieu so lien he, nen chot lich xem va xin so.",
      priority: "High",
    };
  }

  if (days >= 3 && temperature === "Warm") {
    return {
      next_action: "follow_up",
      reason: "Lead am da im lang vai ngay, nen cham lai truoc khi nguoi khac cham.",
      priority: "Medium",
    };
  }

  if (temperature === "Warm") {
    return {
      next_action: "ask_for_viewing",
      reason: "Lead da du am, buoc tiep theo nen day sang lich xem nha.",
      priority: "Medium",
    };
  }

  if (days >= 7) {
    return {
      next_action: "follow_up",
      reason: "Lead da lau chua co hoat dong, nen cham nhe de kiem tra nhu cau.",
      priority: "Low",
    };
  }

  return {
    next_action: "wait",
    reason: "Chua co tin hieu uu tien cao, tam thoi theo doi them.",
    priority: "Low",
  };
};

export const getNextActionLabel = (action: unknown) => {
  if (action === "call_now") return "Can goi ngay";
  if (action === "send_properties") return "Gui bat dong san";
  if (action === "ask_for_viewing") return "Hoi lich xem nha";
  if (action === "follow_up") return "Follow-up";

  return "Cho phan hoi";
};

export const getNextActionPriorityRank = (priority: unknown) => {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;

  return 2;
};
