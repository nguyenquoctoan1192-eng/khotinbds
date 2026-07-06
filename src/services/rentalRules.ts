import type {
  BusinessCategory,
  ConversationState,
  ExtractedConversationState,
  LeadQuality,
} from "../types/state.ts";
import { createConversationState } from "../types/state.ts";
import { detectEscalation, escalationReply } from "./escalation.ts";
import { getKnownBusinessKeywords, matchIndustry } from "./knowledgeMatcher.ts";
import { calculateLeadQuality } from "./leadQuality.ts";
import { compactSpaces, hasKeyword, normalizeVietnameseText } from "./text.ts";
import {
  extractPhoneNumber,
  formatSizeForState,
  normalizeBudget,
  normalizeContactType,
  normalizeSize,
  normalizeStructure,
} from "./validation.ts";

const areaKeywords = [
  "Quận 1",
  "Quận 2",
  "Quận 3",
  "Quận 4",
  "Quận 5",
  "Quận 6",
  "Quận 7",
  "Quận 8",
  "Quận 9",
  "Quận 10",
  "Quận 11",
  "Quận 12",
  "Phú Nhuận",
  "Bình Thạnh",
  "Gò Vấp",
  "Tân Bình",
  "Tân Phú",
  "Bình Tân",
  "Thủ Đức",
  "Nhà Bè",
  "Bình Chánh",
  "Hóc Môn",
  "Củ Chi",
  "Bến Thành",
];

const sortedAreaKeywords = [...areaKeywords].sort((a, b) => b.length - a.length);

function stripNegatedClauses(text: string): string {
  return compactSpaces(
    text.replace(
      /\s*(?:[,;.!?]\s*)?(?:(?:chứ|chu)\s+)?(?:không|khong)\s+phải(?:\s+(?:là|la))?\s+.*?(?=$|[,.!?;]|\s+(?:nhưng|nhung|mà|ma|và|va|rồi|roi)\b)/giu,
      " "
    )
  );
}

function detectBusiness(message: string): {
  business_type: string | null;
  business_category: BusinessCategory | null;
} {
  for (const item of getKnownBusinessKeywords()) {
    if (hasKeyword(message, item.keyword)) {
      return {
        business_type: item.keyword,
        business_category: item.businessCategory,
      };
    }
  }

  const normalized = normalizeVietnameseText(message);
  const match = normalized.match(
    /(?:mo|lam|kinh doanh)\s+([a-z0-9\s]+?)(?:\s+(?:tai|o|quan|q\.?|duong|hem|\d)|$)/
  );

  if (!match?.[1]) {
    return { business_type: null, business_category: null };
  }

  return {
    business_type: compactSpaces(match[1]),
    business_category: "khac",
  };
}

function extractArea(message: string): string | null {
  const normalized = normalizeVietnameseText(message);

  for (const area of sortedAreaKeywords) {
    const normalizedArea = normalizeVietnameseText(area);
    let index = normalized.indexOf(normalizedArea);

    while (index >= 0) {
      const charAfterMatch = normalized[index + normalizedArea.length] ?? "";
      const areaEndsWithDigit = /\d$/.test(normalizedArea);

      if (!areaEndsWithDigit || !/\d/.test(charAfterMatch)) {
        return area;
      }

      index = normalized.indexOf(normalizedArea, index + 1);
    }
  }

  const numberMatch = normalized.match(/(?:quan|q\.?)\s*([0-9]{1,2})(?!\d)/);
  if (numberMatch?.[1]) return `Quận ${numberMatch[1]}`;

  return null;
}

function extractBedroom(message: string): number | null {
  const text = normalizeVietnameseText(message);
  const match = text.match(
    /(\d+)\s*(?:pn|phong ngu|phong(?!\s*(?:kham|gym|tap|lam viec|tro|hoc|hop)\b))/
  );
  const value = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

function extractWc(message: string): number | null {
  const text = normalizeVietnameseText(message);
  const match = text.match(/(\d+)\s*(?:wc|toilet|ve sinh)/);
  const value = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

export function shouldStopForBusy(message: string): boolean {
  const text = normalizeVietnameseText(message);
  return [
    "dang ban",
    "dang hop",
    "dang lai xe",
    "lat noi",
    "de lat",
    "ban roi",
    "khong tien nghe",
  ].some((keyword) => text.includes(keyword));
}

export function extractRentalInfo(
  message: string,
  currentState?: Partial<ConversationState> | null
): ExtractedConversationState {
  const state = createConversationState(currentState);
  const cleanedMessage = stripNegatedClauses(message);
  const text = normalizeVietnameseText(cleanedMessage);
  const extracted: ExtractedConversationState = {};
  const business = detectBusiness(cleanedMessage);

  if (business.business_type) {
    extracted.purpose = "kinh_doanh";
    extracted.business_type = business.business_type;
    extracted.business_category = business.business_category;
  } else if (text.includes("kinh doanh") || text.includes("mat bang kinh doanh")) {
    extracted.purpose = "kinh_doanh";
  }

  if (
    text.includes("de o") ||
    text.includes("nha o") ||
    text.includes("o gia dinh") ||
    text.includes("thue o")
  ) {
    extracted.purpose = "o";
  }

  const area = extractArea(cleanedMessage);
  if (area) extracted.area = area;

  const size = formatSizeForState(normalizeSize(cleanedMessage));
  if (size) extracted.size = size;

  const structure = normalizeStructure(cleanedMessage);
  if (structure) extracted.structure = structure;

  const budget = normalizeBudget(cleanedMessage);
  if (budget) extracted.budget = budget;

  const phone = extractPhoneNumber(cleanedMessage);
  if (phone) {
    extracted.contact = phone;
    extracted.contact_type = normalizeContactType(cleanedMessage) ?? "phone";
  }

  const bedroom = extractBedroom(cleanedMessage);
  if (bedroom) extracted.bedroom = bedroom;

  const wc = extractWc(cleanedMessage);
  if (wc) extracted.wc = wc;

  if (
    ["can gap", "gap lam", "xem ngay", "tuan nay", "hom nay", "ngay mai"].some(
      (keyword) => text.includes(keyword)
    )
  ) {
    extracted.urgent = true;
  }

  if (["so gia cao", "mac qua", "gia cao", "dat qua"].some((keyword) => text.includes(keyword))) {
    extracted.objection = "sợ giá cao";
  }

  if (
    ["tim nhieu noi", "tim mai chua duoc", "mat thoi gian"].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    extracted.pain_point = message;
  }

  if (!extracted.business_category && extracted.business_type) {
    extracted.business_category = matchIndustry(extracted.business_type)?.businessCategory ?? "khac";
  }

  if (!extracted.business_category && state.business_category) {
    extracted.business_category = state.business_category;
  }

  return extracted;
}

export function mergeRentalState(
  currentState: Partial<ConversationState> | null | undefined,
  extractedInfo: ExtractedConversationState
): ConversationState {
  const state = createConversationState(currentState);
  const cleanInfo = Object.fromEntries(
    Object.entries(extractedInfo).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

  return {
    ...state,
    ...cleanInfo,
    unclear_fields: state.unclear_fields ?? [],
    ask_count: state.ask_count ?? {},
  };
}

export function getNextMissingField(
  state: ConversationState
): keyof ConversationState | null {
  const skipped = new Set(state.unclear_fields);

  if (!state.purpose && !skipped.has("purpose")) return "purpose";
  if (
    state.purpose === "kinh_doanh" &&
    !state.business_type &&
    !skipped.has("business_type")
  ) {
    return "business_type";
  }
  if (!state.area && !skipped.has("area")) return "area";
  if (!state.size && !skipped.has("size")) return "size";
  if (!state.structure && !skipped.has("structure")) return "structure";
  if (state.purpose === "o" && state.bedroom === null && !skipped.has("bedroom")) {
    return "bedroom";
  }
  if (!state.budget && !skipped.has("budget")) return "budget";
  if (!state.contact && !skipped.has("contact")) return "contact";
  return null;
}

function hasBasicRequirement(state: ConversationState): boolean {
  if (!state.purpose) return false;
  if (state.purpose === "kinh_doanh" && !state.business_type) return false;
  if (state.purpose === "o" && state.bedroom === null) return false;
  return Boolean(state.area && state.size && state.structure && state.budget);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function increaseAskCount(
  state: ConversationState,
  field: keyof ConversationState
): ConversationState {
  return {
    ...state,
    ask_count: {
      ...state.ask_count,
      [field]: (state.ask_count[field] ?? 0) + 1,
    },
  };
}

function skipOverAskedFields(state: ConversationState): ConversationState {
  let next = getNextMissingField(state);
  let skippedState = state;

  while (next && (skippedState.ask_count[next] ?? 0) >= 3) {
    skippedState = {
      ...skippedState,
      unclear_fields: unique([...skippedState.unclear_fields, next]),
    };
    next = getNextMissingField(skippedState);
  }

  return skippedState;
}

function formatStructure(value: string | null) {
  if (!value) return "";
  return value
    .replace(/^tret_/, "trệt ")
    .replace(/_lau$/, " lầu")
    .replace(/_/g, " ")
    .replace("tret", "trệt");
}

export function summarizeRequirement(state: ConversationState): string {
  const parts: string[] = [];

  if (state.purpose === "kinh_doanh") {
    parts.push(`thuê mặt bằng kinh doanh ${state.business_type ?? ""}`.trim());
  } else {
    parts.push("thuê nhà để ở");
  }

  if (state.area) parts.push(`khu vực ${state.area}`);
  if (state.size) parts.push(`diện tích khoảng ${state.size}`);
  if (state.structure) parts.push(`kết cấu ${formatStructure(state.structure)}`);
  if (state.bedroom) parts.push(`${state.bedroom} phòng ngủ`);
  if (state.wc) parts.push(`${state.wc} WC`);
  if (state.budget) parts.push(`ngân sách khoảng ${state.budget} triệu/tháng`);

  return parts.join(", ");
}

function microSelling(state: ConversationState): string {
  const industry = matchIndustry(state.business_type);
  return industry?.sellingPoints[0] ?? "";
}

function reactionFor(message: string, state: ConversationState): string {
  const known: string[] = [];

  if (state.business_type) known.push(`mô hình ${state.business_type}`);
  if (state.area) known.push(`khu vực ${state.area}`);
  if (state.size) known.push(`diện tích ${state.size}`);
  if (state.budget) known.push(`ngân sách khoảng ${state.budget} triệu/tháng`);

  if (known.length > 0) {
    return `Dạ em nắm được ${known.slice(0, 3).join(", ")} rồi ạ.`;
  }

  return message.trim() ? "Dạ em nắm ý anh/chị rồi ạ." : "Dạ.";
}

function questionFor(
  field: keyof ConversationState,
  previousAskCount: number
) {
  const alternate = previousAskCount >= 2;

  if (field === "purpose") {
    return alternate
      ? "Mình định dùng căn này để sinh hoạt gia đình hay làm kinh doanh là chính ạ?"
      : "Anh/chị đang cần thuê để ở hay kinh doanh ạ?";
  }

  if (field === "business_type") {
    return alternate
      ? "Anh/chị cho em biết ngành hàng chính để em lọc mặt bằng đúng hơn nhé ạ?"
      : "Mình dự định kinh doanh lĩnh vực gì ạ?";
  }

  if (field === "area") {
    return alternate
      ? "Anh/chị ưu tiên quận hoặc khu nào nhất để em bám theo ạ?"
      : "Anh/chị muốn thuê khu vực nào ạ?";
  }

  if (field === "size") {
    return alternate
      ? "Khoảng diện tích sử dụng hoặc ngang dài mong muốn của mình là bao nhiêu ạ?"
      : "Diện tích mình cần khoảng bao nhiêu m2, hoặc ngang x dài khoảng bao nhiêu ạ?";
  }

  if (field === "structure") {
    return alternate
      ? "Mình cần nhà dạng trệt, trệt lầu, có lửng hay nhiều phòng ạ?"
      : "Mình cần kết cấu nhà như thế nào ạ?";
  }

  if (field === "bedroom") {
    return "Mình cần khoảng mấy phòng ngủ, mấy WC ạ?";
  }

  if (field === "budget") {
    return alternate
      ? "Mức thuê tối đa mỗi tháng mình muốn giữ trong khoảng bao nhiêu ạ?"
      : "Ngân sách thuê dự kiến khoảng bao nhiêu một tháng ạ?";
  }

  return "Anh/chị cho em xin số điện thoại hoặc Zalo để em gửi thông tin phù hợp nhé ạ.";
}

export function generateRentalConsultantReply(
  message: string,
  inputState?: Partial<ConversationState> | null
): {
  reply: string;
  state: ConversationState;
  next_missing_field: string | null;
  lead_quality: LeadQuality;
  should_handoff: boolean;
} {
  let state = createConversationState(inputState);
  state = mergeRentalState(state, extractRentalInfo(message, state));

  if (shouldStopForBusy(message)) {
    return {
      reply:
        "Dạ anh/chị cứ tập trung công việc trước nha. Khi nào tiện mình nhắn lại em sau cũng được ạ.",
      state,
      next_missing_field: null,
      lead_quality: calculateLeadQuality(state),
      should_handoff: false,
    };
  }

  if (detectEscalation(message)) {
    return {
      reply: escalationReply,
      state,
      next_missing_field: getNextMissingField(state),
      lead_quality: calculateLeadQuality(state),
      should_handoff: true,
    };
  }

  state = skipOverAskedFields(state);
  const next = getNextMissingField(state);

  if (!next) {
    const urgentText = state.urgent
      ? " Dạ em nhớ mình đang cần gấp nên em sẽ ưu tiên tìm những căn có thể xem ngay được gửi cho anh/chị trước ạ."
      : "";

    return {
      reply:
        "Dạ em đã nhận thông tin của anh/chị rồi ạ. Em sẽ ưu tiên gửi những căn sát nhu cầu nhất trước để anh/chị đỡ mất thời gian xem những căn không phù hợp ạ." +
        urgentText,
      state,
      next_missing_field: null,
      lead_quality: calculateLeadQuality(state),
      should_handoff: false,
    };
  }

  if (next === "contact" && hasBasicRequirement(state)) {
    return {
      reply: `Dạ em nắm được nhu cầu của anh/chị rồi ạ: ${summarizeRequirement(
        state
      )}. Anh/chị cho em xin số điện thoại hoặc Zalo để em gửi những mặt bằng phù hợp nhất bên em nhé ạ.`,
      state,
      next_missing_field: next,
      lead_quality: calculateLeadQuality(state),
      should_handoff: false,
    };
  }

  const previousAskCount = state.ask_count[next] ?? 0;
  state = increaseAskCount(state, next);

  const selling = microSelling(state);
  const prefix = selling || reactionFor(message, state);

  return {
    reply: `${prefix} ${questionFor(next, previousAskCount)}`,
    state,
    next_missing_field: next,
    lead_quality: calculateLeadQuality(state),
    should_handoff: false,
  };
}
