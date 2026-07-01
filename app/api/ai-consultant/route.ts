import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/auth";
import { calculateLeadScoring } from "@/lib/leadScoring";
import { parseVietnameseRequirement } from "@/lib/requirementParser";

type ConsultantIntent =
  | "search_listing"
  | "reply_customer"
  | "save_lead"
  | "follow_up"
  | "explain_match";

type ConsultantBody = {
  message?: unknown;
  text?: unknown;
  intent?: unknown;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const intentValues: ConsultantIntent[] = [
  "search_listing",
  "reply_customer",
  "save_lead",
  "follow_up",
  "explain_match",
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const isIntent = (value: unknown): value is ConsultantIntent =>
  intentValues.includes(value as ConsultantIntent);

function classifyIntent(text: string, requestedIntent?: unknown): ConsultantIntent {
  if (isIntent(requestedIntent)) return requestedIntent;

  const normalized = normalizeText(text);

  if (/\b(luu khach|luu nhu cau|tao lead|them khach|crm)\b/.test(normalized)) {
    return "save_lead";
  }

  if (/\b(vi sao|tai sao|giai thich|phu hop|match)\b/.test(normalized)) {
    return "explain_match";
  }

  if (/\b(follow|follow-up|cham soc|nhac lai|goi lai|hen lai)\b/.test(normalized)) {
    return "follow_up";
  }

  if (/\b(tra loi sao|khach noi|soan tin|nhan tin|phan hoi|reply)\b/.test(normalized)) {
    return "reply_customer";
  }

  if (
    /\b(can thue|can mua|tim|ngang|quan|q\.?\s*\d|gia|tai chinh|mat bang|nha nguyen can|3pn|pn)\b/.test(
      normalized
    )
  ) {
    return "search_listing";
  }

  return "reply_customer";
}

function buildLeadRequest(text: string) {
  const parsed = parseVietnameseRequirement(text);

  return {
    query: text,
    mode: "match",
    note: parsed.note || text,
    preferred_districts: parsed.preferred_districts,
    allow_nearby_districts: parsed.allowNearbyDistricts,
    max_price: parsed.max_price,
    min_price: parsed.min_price,
    target_price: parsed.target_price,
    min_area: parsed.min_area,
    max_area: parsed.max_area,
    target_area: parsed.target_area,
    target_width: parsed.target_width,
    bedrooms: parsed.bedrooms,
    min_bedrooms: parsed.min_bedrooms,
    max_bedrooms: parsed.max_bedrooms,
    property_types: parsed.property_types,
    businessTypes: parsed.businessTypes,
    concepts: parsed.concepts,
    features: parsed.features,
    targetCustomers: parsed.targetCustomers,
    purpose: parsed.purpose,
    keywordSearch: parsed.keywordSearch,
  };
}

function cleanNormalizedRequirement(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      return item !== null && item !== undefined && item !== "";
    })
  );
}

function formatPrice(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return "giá đang cập nhật";
  return `${numberValue.toLocaleString("vi-VN")} VNĐ`;
}

function getListing(item: Record<string, unknown>) {
  return ((item.listing && typeof item.listing === "object" ? item.listing : item) ||
    {}) as Record<string, unknown>;
}

function formatListingLine(item: Record<string, unknown>, index: number) {
  const listing = getListing(item);
  const title = String(listing.title || listing.address || `Căn ${index + 1}`);
  const district = String(listing.district || listing.location || "");
  const price = formatPrice(listing.price);
  const area = listing.area ? `, ${listing.area}m2` : "";
  const score = item.score ? `, điểm phù hợp ${item.score}` : "";

  return `${index + 1}. ${title}${district ? ` - ${district}` : ""}: ${price}${area}${score}`;
}

function buildSearchReply(matches: Array<Record<string, unknown>>, warning?: string) {
  if (matches.length === 0) {
    return warning || "Em chưa thấy căn thật sự khớp. Mình nên nới thêm khu vực, ngân sách hoặc tiêu chí diện tích để lọc lại sát hơn.";
  }

  return [
    `Em lọc được ${matches.length} căn phù hợp nhất. Mình có thể gửi khách trước các căn điểm cao, rồi hỏi khách ưu tiên giá, vị trí hay kết cấu để em lọc tiếp.`,
    ...matches.slice(0, 3).map(formatListingLine),
  ].join("\n");
}

function buildReplyCustomer(text: string) {
  const normalized = normalizeText(text);

  if (/suy nghi|xem lai|can nhac/.test(normalized)) {
    return "Dạ được anh. Anh đang lăn tăn về giá, vị trí hay kết cấu để em lọc lại căn sát hơn cho mình?";
  }

  if (/mac|bot|thuong luong|gia/.test(normalized)) {
    return "Dạ phần giá thường vẫn có thể trao đổi thêm nếu mình thiện chí. Anh cho em biết mức mình muốn chốt, em làm việc lại với chủ rồi báo anh ngay.";
  }

  if (/soan tin|gui khach/.test(normalized)) {
    return "Dạ em gửi anh vài căn phù hợp trước để mình xem nhanh. Căn nào anh thấy ổn về vị trí và ngân sách, em sẽ kiểm tra lịch xem thực tế cho mình.";
  }

  return "Dạ em hiểu. Anh cho em thêm điểm mình ưu tiên nhất là giá, vị trí hay kết cấu, em sẽ tư vấn và lọc lại căn sát nhu cầu hơn.";
}

function buildFollowUpReply(text: string) {
  const normalized = normalizeText(text);

  if (/lan dau|khach moi/.test(normalized)) {
    return "Nên nhắn ngắn gọn xác nhận nhu cầu, gửi 2-3 căn sát nhất, rồi chốt một câu hỏi mở: anh ưu tiên căn nào để em kiểm tra lịch xem?";
  }

  return "Nên follow-up bằng một câu hỏi cụ thể: anh còn ưu tiên khu vực/ngân sách này không, hay em lọc lại phương án khác sát hơn cho mình?";
}

function buildExplainMatchReply(matches: Array<Record<string, unknown>>) {
  const first = matches[0];
  if (!first) {
    return "Chưa có căn để giải thích độ phù hợp. Mình nhập lại nhu cầu hoặc bấm Tìm lại để AI lọc danh sách trước.";
  }

  const reasons = Array.isArray(first.reasons) ? first.reasons : [];
  const warnings = Array.isArray(first.warnings) ? first.warnings : [];

  return [
    `Căn đầu tiên phù hợp vì đạt ${first.score || 0} điểm theo matching hiện tại.`,
    reasons.length > 0 ? `Lý do chính: ${reasons.slice(0, 3).join(", ")}.` : "",
    warnings.length > 0 ? `Cần kiểm tra thêm: ${warnings.slice(0, 2).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractPhone(text: string) {
  return text.match(/(?:^|\D)(0\d{9})(?!\d)/)?.[1] || "";
}

async function runLeadMatching(req: Request, text: string) {
  const origin = new URL(req.url).origin;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;

  const res = await fetch(`${origin}/api/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify(buildLeadRequest(text)),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(String(json.message || "Không thể tìm căn phù hợp"));
  }

  const matches = Array.isArray(json.matches)
    ? (json.matches as Array<Record<string, unknown>>).slice(0, 5)
    : [];

  return {
    matches,
    normalizedRequirement: json.normalizedRequirement || cleanNormalizedRequirement(parseVietnameseRequirement(text)),
    warning: json.fallbackWarning || "",
  };
}

async function saveLead(text: string, normalizedRequirement: Record<string, unknown>) {
  const parsed = parseVietnameseRequirement(text);
  const phone = extractPhone(text);
  const normalized = cleanNormalizedRequirement(normalizedRequirement);
  const basePayload = {
    fullname: "Khách AI",
    phone,
    status: "Khách mới",
    min_price: parsed.min_price,
    max_price: parsed.max_price,
    preferred_districts: parsed.preferred_districts,
    min_area: parsed.min_area,
    bedrooms: parsed.bedrooms,
    note: `raw_requirement=${text} | normalized_requirement=${JSON.stringify(normalized)}`,
  };
  const scoring = calculateLeadScoring({
    phone,
    max_price: parsed.max_price,
    min_price: parsed.min_price,
    preferred_districts: parsed.preferred_districts,
    note: text,
    purpose: parsed.purpose,
  });
  const payloadWithRaw = {
    ...basePayload,
    ...scoring,
    raw_requirement: text,
    normalized_requirement: normalized,
  };

  let { data, error } = await supabase
    .from("leads")
    .insert([payloadWithRaw])
    .select()
    .single();

  if (
    error &&
    /(raw_requirement|normalized_requirement|lead_score|lead_temperature)/i.test(
      String(error.message || "")
    )
  ) {
    const fallback = await supabase
      .from("leads")
      .insert([{ ...basePayload }])
      .select()
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  return data;
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req, ["admin", "agent"]);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as ConsultantBody;
    const text = String(body.message || body.text || "").trim();

    if (!text) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập nội dung tư vấn." },
        { status: 400 }
      );
    }

    const intent = classifyIntent(text, body.intent);
    const parsed = parseVietnameseRequirement(text);
    let matches: Array<Record<string, unknown>> = [];
    let normalizedRequirement: Record<string, unknown> = cleanNormalizedRequirement(parsed);
    let warning = "";
    let reply = "";
    let lead: unknown = null;

    if (intent === "search_listing" || intent === "explain_match") {
      const result = await runLeadMatching(req, text);
      matches = result.matches;
      normalizedRequirement = result.normalizedRequirement;
      warning = result.warning;
      reply =
        intent === "explain_match"
          ? buildExplainMatchReply(matches)
          : buildSearchReply(matches, warning);
    } else if (intent === "save_lead") {
      lead = await saveLead(text, normalizedRequirement);
      reply = "Em đã lưu nhu cầu vào CRM với trạng thái Khách mới. Mình có thể tiếp tục tìm căn phù hợp hoặc soạn tin gửi khách.";
    } else if (intent === "follow_up") {
      reply = buildFollowUpReply(text);
    } else {
      reply = buildReplyCustomer(text);
    }

    return NextResponse.json({
      success: true,
      intent,
      reply,
      normalizedRequirement,
      matches,
      warnings: warning ? [warning] : [],
      lead,
    });
  } catch (error) {
    console.error("ai-consultant failed", error);

    return NextResponse.json(
      { success: false, message: "Không xử lý được yêu cầu tư vấn." },
      { status: 500 }
    );
  }
}
