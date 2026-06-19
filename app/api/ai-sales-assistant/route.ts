import { NextResponse } from "next/server";

type CustomerPurpose = "ở" | "kinh doanh" | "văn phòng";

type CustomerContext = {
  purpose?: CustomerPurpose;
  business?: string;
  district?: string;
  budget?: string;
  size?: string;
  minArea?: number;
  frontage?: boolean;
  alleyCar?: boolean;
  priorityStreets?: string[];
};

type CustomerFacts = Partial<CustomerContext>;

type ConversationMessage = {
  role?: string;
  type?: string;
  content?: string;
  message?: string;
};

type AiSalesAssistantBody = {
  message?: string;
  leadId?: string;
  conversationHistory?: ConversationMessage[];
  currentContext?: CustomerContext;
  lead?: Record<string, unknown>;
  history?: ConversationMessage[];
};

type NextAction = "ask_more_info" | "suggest_listings" | "schedule_viewing";

const priorityStreetNames = [
  "Nguyễn Cư Trinh",
  "Cống Quỳnh",
  "Cô Giang",
  "Tôn Thất Tùng",
];

const districtPatterns: Array<[string, RegExp]> = [
  ["Quận 1", /\b(?:quan|q)\.?\s*1\b/],
  ["Quận 3", /\b(?:quan|q)\.?\s*3\b/],
  ["Phú Nhuận", /\bphu\s*nhuan\b/],
  ["Bình Thạnh", /\bbinh\s*thanh\b/],
  ["Gò Vấp", /\bgo\s*vap\b/],
  ["Tân Bình", /\btan\s*binh\b/],
  ["Tân Phú", /\btan\s*phu\b/],
  ["Quận 10", /\b(?:quan|q)\.?\s*10\b/],
];

const businessPatterns: Array<[string, RegExp]> = [
  ["shop hoa", /\bshop\s*hoa\b|\bhoa\s*tuoi\b/],
  ["spa", /\bspa\b|\btham\s*my\b|\bnail\b|\bsalon\b/],
  ["cafe", /\bcafe\b|\bca\s*phe\b|\bcoffee\b/],
  ["quán ăn", /\bquan\s*an\b|\bnha\s*hang\b|\ban\s*uong\b|\bf&b\b|\bfnb\b/],
  ["văn phòng", /\bvan\s*phong\b|\boffice\b|\bcong\s*ty\b|\bvp\b/],
];

const compactString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const uniqueValues = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const normalizeContext = (value: unknown): CustomerContext => {
  if (!value || typeof value !== "object") return {};

  const source = value as CustomerContext;
  return {
    purpose: source.purpose,
    business: source.business,
    district: source.district,
    budget: source.budget,
    size: source.size,
    minArea:
      typeof source.minArea === "number" && Number.isFinite(source.minArea)
        ? source.minArea
        : undefined,
    frontage: typeof source.frontage === "boolean" ? source.frontage : undefined,
    alleyCar: typeof source.alleyCar === "boolean" ? source.alleyCar : undefined,
    priorityStreets: Array.isArray(source.priorityStreets)
      ? uniqueValues(source.priorityStreets)
      : undefined,
  };
};

const formatBudget = (rawAmount: string, hasLimit: boolean) => {
  const amount = Number(rawAmount.replace(",", "."));
  if (!Number.isFinite(amount)) return "";

  const amountLabel = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return hasLimit ? `dưới ${amountLabel} triệu` : `${amountLabel} triệu`;
};

export const extractCustomerFacts = (message: string): CustomerFacts => {
  const normalized = normalizeText(message);
  const facts: CustomerFacts = {};

  if (/\b(de\s*o|o|nha\s*o|can\s*ho\s*o)\b/.test(normalized)) {
    facts.purpose = "ở";
  }

  if (/\bkinh\s*doanh\b|\bmat\s*bang\b|\bmb\b|\bshop\b/.test(normalized)) {
    facts.purpose = "kinh doanh";
  }

  if (/\bvan\s*phong\b|\boffice\b|\bcong\s*ty\b|\bvp\b/.test(normalized)) {
    facts.purpose = "văn phòng";
    facts.business = "văn phòng";
  }

  for (const [business, pattern] of businessPatterns) {
    if (pattern.test(normalized)) {
      facts.business = business;
      if (business !== "văn phòng") {
        facts.purpose = "kinh doanh";
      }
      break;
    }
  }

  for (const [district, pattern] of districtPatterns) {
    if (pattern.test(normalized)) {
      facts.district = district;
      break;
    }
  }

  const budgetMatch = normalized.match(
    /(?:duoi\s*)?(\d+(?:[.,]\d+)?)\s*(?:tr|trieu)(?:\s*do\s*lai)?/
  );
  if (budgetMatch?.[1]) {
    facts.budget = formatBudget(
      budgetMatch[1],
      /duoi|do\s*lai/.test(budgetMatch[0])
    );
  }

  const sizeMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\b/);
  if (sizeMatch?.[1] && sizeMatch?.[2]) {
    const width = Number(sizeMatch[1].replace(",", "."));
    const length = Number(sizeMatch[2].replace(",", "."));

    facts.size = `${sizeMatch[1].replace(",", ".")}x${sizeMatch[2].replace(",", ".")}`;
    if (Number.isFinite(width) && Number.isFinite(length)) {
      facts.minArea = Math.round(width * length);
    }
  }

  const areaMatch = normalized.match(/(?:tu\s*)?(\d{2,4})\s*m(?:2|²)?/);
  if (!facts.minArea && areaMatch?.[1]) {
    facts.minArea = Number(areaMatch[1]);
  }

  if (/\bmat\s*tien\b|\bmt\b|\bfrontage\b/.test(normalized)) {
    facts.frontage = true;
  }

  if (/\bhem\s*xe\s*hoi\b|\bhxh\b|\boto\b|\bo\s*to\b|\bxe\s*hoi\b/.test(normalized)) {
    facts.alleyCar = true;
  }

  const foundStreets = priorityStreetNames.filter((street) =>
    normalized.includes(normalizeText(street))
  );
  if (foundStreets.length > 0) {
    facts.priorityStreets = foundStreets;
  }

  return facts;
};

export const mergeCustomerContext = (
  oldContext: CustomerContext,
  newFacts: CustomerFacts
): CustomerContext => {
  const merged: CustomerContext = {
    ...normalizeContext(oldContext),
  };

  for (const key of [
    "purpose",
    "business",
    "district",
    "budget",
    "size",
    "minArea",
    "frontage",
    "alleyCar",
  ] as const) {
    if (newFacts[key] !== undefined && newFacts[key] !== null && newFacts[key] !== "") {
      merged[key] = newFacts[key] as never;
    }
  }

  merged.priorityStreets = uniqueValues([
    ...(merged.priorityStreets || []),
    ...(newFacts.priorityStreets || []),
  ]);

  if (merged.priorityStreets.length === 0) {
    delete merged.priorityStreets;
  }

  return merged;
};

export const shouldAskQuestion = (
  context: CustomerContext,
  fieldName: keyof CustomerContext | "sizeOrFrontageOrStreet"
) => {
  if (fieldName === "sizeOrFrontageOrStreet") {
    return !(
      context.size ||
      context.frontage ||
      context.alleyCar ||
      (context.priorityStreets && context.priorityStreets.length > 0)
    );
  }

  if (fieldName === "priorityStreets") {
    return !(context.priorityStreets && context.priorityStreets.length > 0);
  }

  return context[fieldName] === undefined || context[fieldName] === null || context[fieldName] === "";
};

export const buildCustomerContextPrompt = (
  context: CustomerContext,
  conversationHistory: ConversationMessage[],
  message: string
) => {
  const historyText = conversationHistory
    .map((item) => compactString(item.content || item.message))
    .filter(Boolean)
    .slice(-6)
    .join("\n");

  return [
    "Customer Context Engine",
    `Context: ${JSON.stringify(context)}`,
    historyText ? `Recent conversation:\n${historyText}` : "",
    `Current message: ${message}`,
    "Rule: Never ask again for a field already present in context.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const getMissingFields = (context: CustomerContext) => {
  const missing: string[] = [];

  if (shouldAskQuestion(context, "purpose")) missing.push("purpose");
  if (shouldAskQuestion(context, "district")) missing.push("district");
  if (shouldAskQuestion(context, "budget")) missing.push("budget");
  if (context.purpose === "kinh doanh" && shouldAskQuestion(context, "business")) {
    missing.push("business");
  }
  if (shouldAskQuestion(context, "sizeOrFrontageOrStreet")) {
    missing.push("size/frontage_or_street_priority");
  }

  return missing;
};

const isQualified = (context: CustomerContext) =>
  Boolean(
    context.purpose &&
      context.district &&
      context.budget &&
      (context.purpose !== "kinh doanh" || context.business) &&
      (context.size ||
        context.frontage ||
        context.alleyCar ||
        (context.priorityStreets && context.priorityStreets.length > 0))
  );

const buildNeedSummary = (context: CustomerContext) => {
  const parts = [
    context.purpose === "kinh doanh" ? "mặt bằng kinh doanh" : context.purpose,
    context.business && context.business !== "văn phòng" ? context.business : "",
    context.district,
    context.budget ? `ngân sách khoảng ${context.budget}` : "",
  ].filter(Boolean);

  return parts.join(" ");
};

const buildAcknowledgement = (newFacts: CustomerFacts) => {
  if (newFacts.priorityStreets?.length) {
    return `Dạ em ghi nhận anh ưu tiên ${newFacts.priorityStreets.join(", ")}.`;
  }

  if (newFacts.frontage) {
    return "Dạ em ghi nhận anh ưu tiên mặt tiền.";
  }

  if (newFacts.alleyCar) {
    return "Dạ em ghi nhận anh cần hẻm xe hơi.";
  }

  if (newFacts.budget) {
    return `Dạ em ghi nhận ngân sách khoảng ${newFacts.budget}.`;
  }

  if (newFacts.district) {
    return `Dạ em ghi nhận khu vực ${newFacts.district}.`;
  }

  if (newFacts.business) {
    return `Dạ em ghi nhận mình kinh doanh ${newFacts.business}.`;
  }

  return "Dạ em nắm thông tin của anh rồi.";
};

const getNextQuestion = (context: CustomerContext) => {
  if (shouldAskQuestion(context, "purpose")) {
    return "Anh đang tìm để ở, kinh doanh hay làm văn phòng để em lọc đúng nhu cầu ạ?";
  }

  if (shouldAskQuestion(context, "district")) {
    return "Anh ưu tiên khu vực nào để em lọc mặt bằng sát hơn ạ?";
  }

  if (shouldAskQuestion(context, "budget")) {
    return "Ngân sách anh muốn giữ khoảng bao nhiêu để em lọc đúng tầm ạ?";
  }

  if (context.purpose === "kinh doanh" && shouldAskQuestion(context, "business")) {
    return "Anh cho em hỏi thêm mình kinh doanh ngành gì để em lọc mặt bằng sát hơn ạ?";
  }

  if (shouldAskQuestion(context, "sizeOrFrontageOrStreet")) {
    return "Anh ưu tiên diện tích khoảng bao nhiêu, mặt tiền hay tuyến đường nào để em lọc sát hơn ạ?";
  }

  return "";
};

const detectNextAction = (context: CustomerContext): NextAction =>
  isQualified(context) ? "suggest_listings" : "ask_more_info";

const buildReply = (
  context: CustomerContext,
  newFacts: CustomerFacts,
  missingFields: string[]
) => {
  const acknowledgement = buildAcknowledgement(newFacts);
  const needSummary = buildNeedSummary(context);

  if (missingFields.length === 0) {
    const streetText = context.priorityStreets?.length
      ? `, ưu tiên tuyến ${context.priorityStreets.join(", ")}`
      : "";
    const frontageText = context.frontage
      ? ", ưu tiên mặt tiền"
      : context.alleyCar
        ? ", ưu tiên hẻm xe hơi"
        : "";

    return `${acknowledgement} Hiện nhu cầu của anh là ${needSummary}${streetText}${frontageText}. Em sẽ lọc vài căn sát nhất để anh so nhanh. Anh muốn xem nhà hôm nay hay ngày mai tiện hơn ạ?`;
  }

  const question = getNextQuestion(context);

  if (needSummary) {
    return `${acknowledgement} Hiện nhu cầu của anh là ${needSummary}. ${question}`;
  }

  return `${acknowledgement} ${question}`;
};

const buildLegacyAssistant = (
  context: CustomerContext,
  missingFields: string[],
  reply: string
) => ({
  known_requirements: {
    business: context.business || context.purpose || null,
    location: context.district || null,
    budget: context.budget || null,
    area: context.size || (context.minArea ? `${context.minArea}m2` : null),
    structure: context.priorityStreets?.join(", ") || null,
    frontage: context.frontage
      ? "mặt tiền"
      : context.alleyCar
        ? "hẻm xe hơi"
        : null,
    move_in_time: null,
  },
  missing_requirements: missingFields,
  customer_intent: "customer is sharing requirements",
  objection: null,
  suggested_replies: [reply],
  next_best_question: getNextQuestion(context),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AiSalesAssistantBody;
    const message = compactString(body.message);

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Thiếu tin nhắn khách vừa gửi." },
        { status: 400 }
      );
    }

    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
      : Array.isArray(body.history)
        ? body.history
        : [];
    const oldContext = normalizeContext(body.currentContext || {});
    const newFacts = extractCustomerFacts(message);
    const updatedContext = mergeCustomerContext(oldContext, newFacts);
    const missingFields = getMissingFields(updatedContext);
    const reply = buildReply(updatedContext, newFacts, missingFields);
    const nextAction = detectNextAction(updatedContext);

    buildCustomerContextPrompt(updatedContext, conversationHistory, message);

    return NextResponse.json({
      success: true,
      reply,
      updatedContext,
      missingFields,
      nextAction,
      assistant: buildLegacyAssistant(updatedContext, missingFields, reply),
    });
  } catch (error) {
    console.error("AI sales assistant failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Không tạo được gợi ý trả lời.",
      },
      { status: 500 }
    );
  }
}
