export type RentalPurpose = "o" | "kinh_doanh";
export type ContactType = "phone" | "zalo";
export type LeadQuality = "hot" | "warm" | "cold";
export type BusinessCategory =
  | "beauty"
  | "f_and_b"
  | "retail"
  | "office"
  | "warehouse"
  | "clinic"
  | "khac";

export type RentalConsultationState = {
  purpose: RentalPurpose | null;
  business_type: string | null;
  business_category: BusinessCategory | null;
  area: string | null;
  size: string | null;
  structure: string | null;
  bedroom: number | null;
  wc: number | null;
  budget: number | null;
  contact: string | null;
  contact_type: ContactType | null;
  urgent: boolean;
  pain_point: string | null;
  objection: string | null;
  unclear_fields: string[];
  ask_count: Record<string, number>;
  notes: string | null;
};

export type ExtractedRentalInfo = Partial<RentalConsultationState>;

export const defaultRentalState: RentalConsultationState = {
  purpose: null,
  business_type: null,
  business_category: null,
  area: null,
  size: null,
  structure: null,
  bedroom: null,
  wc: null,
  budget: null,
  contact: null,
  contact_type: null,
  urgent: false,
  pain_point: null,
  objection: null,
  unclear_fields: [],
  ask_count: {},
  notes: null,
};

const businessCategoryMap = {
  beauty: ["spa", "nail", "tiệm tóc", "salon"],
  f_and_b: ["cafe", "cà phê", "quán ăn", "nhà hàng", "quán bún", "quán phở"],
  retail: ["shop", "showroom", "cửa hàng", "shop mỹ phẩm"],
  office: ["văn phòng", "coworking"],
  warehouse: ["kho", "xưởng"],
  clinic: ["phòng khám", "nha khoa"],
} satisfies Record<Exclude<BusinessCategory, "khac">, string[]>;

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

const handoffReply =
  "Dạ để đảm bảo chính xác nhất, em xin phép chuyển thông tin này cho anh/chị quản lý bên em liên hệ trực tiếp với mình nhé ạ.";

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function compactSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(normalizedKeyword).replace(/\s+/g, "\\s+")}(?:$|[^a-z0-9])`
  );

  return pattern.test(text);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function createRentalState(
  state?: Partial<RentalConsultationState> | null
): RentalConsultationState {
  return {
    ...defaultRentalState,
    ...(state ?? {}),
    unclear_fields: Array.isArray(state?.unclear_fields)
      ? state.unclear_fields
      : [],
    ask_count:
      state?.ask_count && typeof state.ask_count === "object"
        ? state.ask_count
        : {},
  };
}

export function detectBusinessCategory(message: string): {
  business_type: string | null;
  business_category: BusinessCategory | null;
} {
  const normalized = normalizeText(message);

  for (const [category, keywords] of Object.entries(businessCategoryMap)) {
    for (const keyword of keywords) {
      if (hasKeyword(normalized, keyword)) {
        return {
          business_type: keyword,
          business_category: category as BusinessCategory,
        };
      }
    }
  }

  const openBusinessMatch = normalized.match(
    /(?:mo|lam|kinh doanh)\s+([a-z0-9\s]+?)(?:\s+(?:tai|o|quan|q\.?|duong|hem|\d)|$)/
  );

  if (openBusinessMatch?.[1]) {
    return {
      business_type: compactSpaces(openBusinessMatch[1]),
      business_category: "khac",
    };
  }

  return {
    business_type: null,
    business_category: null,
  };
}

export function extractPhone(message: string): string | null {
  const compact = message.replace(/[\s.-]/g, "");
  const match = compact.match(/(?:0|\+84)(?:3|5|7|8|9)[0-9]{8}/);
  return match?.[0] ?? null;
}

export function extractBudget(message: string): number | null {
  const text = normalizeText(message);
  const chucMatch = text.match(/(\d{1,2})\s*chuc/);

  if (chucMatch) {
    const chuc = Number(chucMatch[1]);
    return Number.isFinite(chuc) ? chuc * 10 : null;
  }

  const unitMatch = text.match(/(\d{1,3})(?:[.,]\d+)?\s*(?:trieu|tr|cu|chai)\b/);

  if (unitMatch) {
    const value = Number(unitMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const budgetWordMatch = text.match(
    /(?:duoi|toi da|max|tam|khoang|ngan sach|gia|budget)\s*(\d{1,3})(?:\b|\/thang| mot thang)/
  );

  if (budgetWordMatch) {
    const value = Number(budgetWordMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

export function extractSize(message: string): string | null {
  const text = normalizeText(message);
  const dimensionMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)/
  );

  if (dimensionMatch) {
    return `${dimensionMatch[1].replace(",", ".")}x${dimensionMatch[2].replace(",", ".")}`;
  }

  const areaMatch = text.match(/(\d{2,4})\s*(?:m2|m²|m\^2|met vuong|met|m)(?:\b|$)/);

  if (areaMatch) {
    return `${areaMatch[1]}m2`;
  }

  return null;
}

export function extractArea(message: string): string | null {
  const text = normalizeText(message);

  for (const area of areaKeywords) {
    if (text.includes(normalizeText(area))) {
      return area;
    }
  }

  const districtNumberMatch = text.match(/(?:quan|q\.?)\s*([0-9]{1,2})\b/);

  if (districtNumberMatch?.[1]) {
    return `Quận ${districtNumberMatch[1]}`;
  }

  const districtNameMatch = message.match(
    /(?:quận|quan|q\.?)\s+([A-Za-zÀ-ỹ\s]+?)(?:\s+\d|\s+tầm|\s+khoảng|\s+dưới|\s+ngân|\s+mở|$)/i
  );

  if (districtNameMatch?.[1]) {
    return compactSpaces(districtNameMatch[0]);
  }

  return null;
}

export function extractStructure(message: string): string | null {
  const text = normalizeText(message);

  if (text.match(/\b\d+\s*pn\b/) || text.includes("phong ngu")) {
    const bedroom = text.match(/(\d+)\s*(?:pn|phong ngu)/)?.[1];
    const wc = text.match(/(\d+)\s*(?:wc|toilet|ve sinh)/)?.[1];
    return compactSpaces(
      `${bedroom ? `${bedroom} phòng ngủ` : "có phòng ngủ"}${wc ? `, ${wc} WC` : ""}`
    );
  }

  if (text.includes("tret") && text.includes("lung")) return "trệt lửng";

  const groundFloorMatch = text.match(/(?:tret\s*)?(\d+)\s*lau/);
  if (text.includes("tret") && groundFloorMatch?.[1]) {
    return `trệt ${groundFloorMatch[1]} lầu`;
  }

  if (text.includes("tret") && text.includes("lau")) return "trệt lầu";
  if (text.includes("san thuong")) return "có sân thượng";
  if (text.includes("lung")) return "có lửng";
  if (text.includes("tret")) return "trệt";

  return null;
}

function extractBedroom(message: string): number | null {
  const text = normalizeText(message);
  const match = text.match(/(\d+)\s*(?:pn|phong ngu)/);
  const value = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

function extractWc(message: string): number | null {
  const text = normalizeText(message);
  const match = text.match(/(\d+)\s*(?:wc|toilet|ve sinh)/);
  const value = match?.[1] ? Number(match[1]) : null;
  return Number.isFinite(value) ? value : null;
}

export function shouldStopForBusy(message: string): boolean {
  const text = normalizeText(message);
  return hasAny(text, [
    "dang ban",
    "dang hop",
    "dang lai xe",
    "lat noi",
    "de lat",
    "ban roi",
    "khong tien nghe",
  ]);
}

export function shouldHandoff(message: string): boolean {
  const text = normalizeText(message);
  return hasAny(text, [
    "khieu nai",
    "buc minh",
    "noi nong",
    "hop dong",
    "phap ly",
    "so do",
    "tranh chap",
    "thuong luong",
    "dam phan",
    "30 phut",
    "xem gap",
    "xem ngay",
  ]);
}

export function extractRentalInfo(
  message: string,
  currentState?: Partial<RentalConsultationState> | null
): ExtractedRentalInfo {
  const state = createRentalState(currentState);
  const text = normalizeText(message);
  const extracted: ExtractedRentalInfo = {};
  const business = detectBusinessCategory(message);

  if (business.business_type) {
    extracted.purpose = "kinh_doanh";
    extracted.business_type = business.business_type;
    extracted.business_category = business.business_category;
  } else if (hasAny(text, ["kinh doanh", "mat bang kinh doanh"])) {
    extracted.purpose = "kinh_doanh";
  }

  if (hasAny(text, ["de o", "nha o", "o gia dinh", "thue o"])) {
    extracted.purpose = "o";
  }

  const area = extractArea(message);
  if (area) extracted.area = area;

  const size = extractSize(message);
  if (size) extracted.size = size;

  const structure = extractStructure(message);
  if (structure) extracted.structure = structure;

  const bedroom = extractBedroom(message);
  if (bedroom) extracted.bedroom = bedroom;

  const wc = extractWc(message);
  if (wc) extracted.wc = wc;

  const budget = extractBudget(message);
  if (budget) extracted.budget = budget;

  const phone = extractPhone(message);
  if (phone) {
    extracted.contact = phone;
    extracted.contact_type = text.includes("zalo") ? "zalo" : "phone";
  }

  if (hasAny(text, ["can gap", "gap lam", "xem ngay", "tuan nay", "hom nay", "ngay mai"])) {
    extracted.urgent = true;
  }

  if (hasAny(text, ["so gia cao", "mac qua", "gia cao", "dat qua"])) {
    extracted.objection = "sợ giá cao";
  }

  if (hasAny(text, ["tim nhieu noi", "tim mai chua duoc", "mat thoi gian"])) {
    extracted.pain_point = message;
  }

  if (!extracted.business_category && state.business_category) {
    extracted.business_category = state.business_category;
  }

  return extracted;
}

export function mergeRentalState(
  currentState: Partial<RentalConsultationState> | null | undefined,
  extractedInfo: ExtractedRentalInfo
): RentalConsultationState {
  const state = createRentalState(currentState);
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
  state: RentalConsultationState
): keyof RentalConsultationState | null {
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
  if (!state.budget && !skipped.has("budget")) return "budget";
  if (!state.contact && !skipped.has("contact")) return "contact";
  return null;
}

function hasBasicRequirement(state: RentalConsultationState): boolean {
  if (!state.purpose) return false;
  if (state.purpose === "kinh_doanh" && !state.business_type) return false;
  return Boolean(state.area && state.size && state.structure && state.budget);
}

export function calculateLeadQuality(state: RentalConsultationState): LeadQuality {
  const requiredFields = [
    state.purpose,
    state.purpose === "kinh_doanh" ? state.business_type : "not_required",
    state.area,
    state.size,
    state.structure,
    state.budget,
  ];
  const filledRequired = requiredFields.filter(Boolean).length;
  const hasAllRequired = filledRequired === requiredFields.length;

  if (state.contact && state.budget && state.area && (state.urgent || hasAllRequired)) {
    return "hot";
  }

  if (state.contact && filledRequired >= requiredFields.length - 2) {
    return "warm";
  }

  return "cold";
}

function microSelling(state: RentalConsultationState): string {
  switch (state.business_category) {
    case "beauty":
      return "Với spa/nail/salon, em sẽ ưu tiên mặt bằng dễ nhận diện, có chỗ để xe và điện nước đủ tải.";
    case "f_and_b":
      return "Với cafe/quán ăn, em sẽ lưu ý thêm hút mùi, thoát nước và vị trí có khách qua lại.";
    case "retail":
      return "Với shop/showroom, mặt tiền rộng và dễ trưng bày sẽ lợi thế hơn ạ.";
    case "office":
      return "Với văn phòng, em sẽ để ý chỗ để xe và thang máy nếu mình cần tầng cao.";
    case "warehouse":
      return "Với kho/xưởng, đường lớn và xe tải ra vào được là điểm rất quan trọng.";
    case "clinic":
      return "Với phòng khám/nha khoa, vị trí dễ tiếp cận và yếu tố giấy phép ngành y tế cần được lưu ý kỹ.";
    default:
      return "";
  }
}

function reactionFor(message: string, state: RentalConsultationState): string {
  const known: string[] = [];

  if (state.business_type) known.push(`mô hình ${state.business_type}`);
  if (state.area) known.push(`khu vực ${state.area}`);
  if (state.size) known.push(`diện tích ${state.size}`);
  if (state.budget) known.push(`ngân sách khoảng ${state.budget} triệu/tháng`);

  if (known.length > 0) {
    return `Dạ em nắm được ${known.slice(0, 3).join(", ")} rồi ạ.`;
  }

  if (message.trim()) {
    return "Dạ em nắm ý anh/chị rồi ạ.";
  }

  return "Dạ.";
}

export function summarizeRequirement(state: RentalConsultationState): string {
  const parts: string[] = [];

  if (state.purpose === "kinh_doanh") {
    parts.push(`thuê mặt bằng kinh doanh ${state.business_type ?? ""}`.trim());
  } else {
    parts.push("thuê nhà để ở");
  }

  if (state.area) parts.push(`khu vực ${state.area}`);
  if (state.size) parts.push(`diện tích khoảng ${state.size}`);
  if (state.structure) parts.push(`kết cấu ${state.structure}`);
  if (state.budget) parts.push(`ngân sách khoảng ${state.budget} triệu/tháng`);

  return parts.join(", ");
}

function increaseAskCount(
  state: RentalConsultationState,
  field: keyof RentalConsultationState
): RentalConsultationState {
  return {
    ...state,
    ask_count: {
      ...state.ask_count,
      [field]: (state.ask_count[field] ?? 0) + 1,
    },
  };
}

function skipOverAskedFields(state: RentalConsultationState): RentalConsultationState {
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

function questionFor(
  state: RentalConsultationState,
  field: keyof RentalConsultationState,
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
      : "Diện tích mình cần khoảng bao nhiêu m², hoặc ngang x dài khoảng bao nhiêu ạ?";
  }

  if (field === "structure") {
    return alternate
      ? "Mình cần nhà dạng trệt, trệt lầu, có lửng hay nhiều phòng ạ?"
      : "Mình cần kết cấu nhà như thế nào ạ?";
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
  inputState?: Partial<RentalConsultationState> | null
): {
  reply: string;
  state: RentalConsultationState;
  next_missing_field: string | null;
  lead_quality: LeadQuality;
  should_handoff: boolean;
} {
  let state = createRentalState(inputState);
  const extracted = extractRentalInfo(message, state);
  state = mergeRentalState(state, extracted);

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

  if (shouldHandoff(message)) {
    return {
      reply: handoffReply,
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
  const question = questionFor(state, next, previousAskCount);

  return {
    reply: `${prefix} ${question}`,
    state,
    next_missing_field: next,
    lead_quality: calculateLeadQuality(state),
    should_handoff: false,
  };
}
