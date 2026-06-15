export type LeadTemperature = "Cold" | "Warm" | "Hot";

export type LeadScoringIntent =
  | "ask_photo"
  | "ask_video"
  | "ask_viewing"
  | "hot_lead"
  | "ask_availability"
  | "ask_price_negotiation"
  | string
  | null
  | undefined;

export type LeadScoringInput = {
  phone?: unknown;
  budget?: unknown;
  max_price?: unknown;
  min_price?: unknown;
  location?: unknown;
  preferred_districts?: unknown;
  purpose?: unknown;
  business?: unknown;
  business_type?: unknown;
  note?: unknown;
  detected_intent?: LeadScoringIntent;
  intents?: LeadScoringIntent[];
  activities?: Array<{ type?: unknown; content?: unknown }>;
};

export type LeadScoringResult = {
  lead_score: number;
  lead_temperature: LeadTemperature;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasValue);

  return Boolean(value);
};

const hasBudget = (input: LeadScoringInput) =>
  hasValue(input.budget) ||
  hasValue(input.max_price) ||
  hasValue(input.min_price) ||
  /(?:budget|ngan sach|ngân sách|max_price|gia|giá)\s*[=:]?\s*\d|(?:\d+(?:[.,]\d+)?\s*(?:tr|trieu|triệu|ty|tỷ|ti|tỉ))/.test(
    normalizeText(input.note)
  );

const hasLocation = (input: LeadScoringInput) =>
  hasValue(input.location) ||
  hasValue(input.preferred_districts) ||
  /(?:location|khu vuc|khu vực|quan|quận|q\.?\s*\d|phu nhuan|binh thanh|go vap|tan binh|tan phu|thu duc)/.test(
    normalizeText(input.note)
  );

const hasPurpose = (input: LeadScoringInput) =>
  hasValue(input.purpose) ||
  hasValue(input.business) ||
  hasValue(input.business_type) ||
  /(?:purpose|business|need|nhu cau|nhu cầu|kinh doanh|mat bang|mặt bằng|de o|để ở|nha o|nhà ở|studio|spa|cafe|office|van phong|văn phòng|quan an|quán ăn)/.test(
    normalizeText(input.note)
  );

const normalizeIntent = (value: unknown) => {
  const normalized = normalizeText(value);

  if (/ask_photo|co hinh|có hình|hinh thuc te|hình thực tế/.test(normalized)) return "ask_photo";
  if (/ask_video|co video|có video|clip/.test(normalized)) return "ask_video";
  if (/ask_viewing|ask_viewing_time|di xem|xem nha|xem nhà|hen xem|hẹn xem/.test(normalized)) return "ask_viewing";
  if (/hot_lead|thich can|thích căn|chot|chốt|can gap|cần gấp/.test(normalized)) return "hot_lead";
  if (/ask_availability|con can|còn căn|chu cho thue|chủ cho thuê/.test(normalized)) return "ask_availability";
  if (/ask_price_negotiation|co bot|có bớt|thuong luong|thương lượng/.test(normalized)) return "ask_price_negotiation";

  return normalized || null;
};

const collectIntents = (input: LeadScoringInput) => {
  const rawIntents = [
    input.detected_intent,
    ...(input.intents || []),
    ...(input.activities || []).flatMap((activity) => [activity.type, activity.content]),
  ];

  return new Set(rawIntents.map(normalizeIntent).filter(Boolean));
};

export const getLeadTemperature = (score: number): LeadTemperature => {
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";

  return "Cold";
};

export const calculateLeadScoring = (input: LeadScoringInput): LeadScoringResult => {
  let score = 0;

  if (hasValue(input.phone)) score += 20;
  if (hasBudget(input)) score += 10;
  if (hasLocation(input)) score += 10;
  if (hasPurpose(input)) score += 10;

  const intents = collectIntents(input);

  if (intents.has("ask_photo")) score += 20;
  if (intents.has("ask_video")) score += 20;
  if (intents.has("ask_viewing")) score += 30;
  if (intents.has("hot_lead")) score += 30;
  if (intents.has("ask_availability")) score += 20;
  if (intents.has("ask_price_negotiation")) score += 10;

  const hasQualifiedNeed = hasBudget(input) && hasLocation(input) && hasPurpose(input);
  const hasWarmBuyingSignal =
    intents.has("ask_price_negotiation") || intents.has("ask_availability");

  if (hasQualifiedNeed && hasWarmBuyingSignal && score < 50) {
    score = 50;
  }

  const lead_score = Math.max(0, Math.min(100, score));

  return {
    lead_score,
    lead_temperature: getLeadTemperature(lead_score),
  };
};

export const getLeadTemperatureLabel = (temperature: unknown) => {
  if (temperature === "Hot") return "🔥 Hot";
  if (temperature === "Warm") return "🟡 Warm";

  return "⚪ Cold";
};

export const getLeadTemperatureRank = (temperature: unknown) => {
  if (temperature === "Hot") return 0;
  if (temperature === "Warm") return 1;

  return 2;
};
