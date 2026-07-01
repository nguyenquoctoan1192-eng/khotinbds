export type CustomerDisplayLead = {
  fullname?: string | null;
  phone?: string | null;
  preferred_districts?: unknown;
  note?: string | null;
  max_price?: number | string | null;
  min_price?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  lead_temperature?: string | null;
  [key: string]: unknown;
};

export type CustomerRequirementDetails = {
  propertyType: string;
  location: string;
  budget: string;
  width: string;
  area: string;
  purpose: string;
  neededTime: string;
  extraNote: string;
};

type ParsedScalarKey = Exclude<keyof ParsedCustomerNote, "freeText">;

const NOTE_KEY_ALIASES: Record<string, ParsedScalarKey> = {
  purpose: "purpose",
  need: "need",
  nhu_cau: "need",
  business: "business",
  business_type: "business",
  use_case: "business",
  location: "location",
  district: "location",
  preferred_districts: "location",
  budget: "budget",
  max_price: "budget",
  price: "budget",
  width: "width",
  ngang: "width",
  area: "area",
  dien_tich: "area",
  structure: "structure",
  ket_cau: "structure",
  frontage: "frontage",
  mat_tien: "frontage",
  move_in_time: "neededTime",
  rental_time: "neededTime",
  time: "neededTime",
  follow_up_date: "followUpDate",
  source: "source",
  nguon: "source",
  note: "extraNote",
};

type ParsedCustomerNote = {
  need?: string;
  purpose?: string;
  business?: string;
  location?: string;
  budget?: string;
  width?: string;
  area?: string;
  structure?: string;
  frontage?: string;
  neededTime?: string;
  followUpDate?: string;
  source?: string;
  extraNote?: string;
  freeText: string[];
};

const RAW_BLOCK_KEYS = /^(assistant|conversation|history|messages?|system|raw|profile|json)$/i;

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .trim();

const titleCaseVietnamese = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return "";

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanValue = (value: unknown) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

const normalizeKey = (key: string) =>
  normalizeText(key)
    .replace(/[/-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const splitNoteParts = (note: string) =>
  note
    .split(/\s*\|\s*|\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

const isRawMachineValue = (value: string) => {
  const normalized = normalizeText(value);

  return (
    normalized.includes("assistant:") ||
    normalized.startsWith("assistant=") ||
    normalized.startsWith("conversation=") ||
    normalized.startsWith("{") ||
    normalized.length > 220
  );
};

export const formatCustomerDistricts = (input: unknown) => {
  const districts =
    input &&
    typeof input === "object" &&
    "preferred_districts" in input
      ? (input as CustomerDisplayLead).preferred_districts
      : input;

  if (Array.isArray(districts)) {
    return districts.map(cleanValue).filter(Boolean).join(", ");
  }

  if (typeof districts === "string") {
    return districts
      .split(",")
      .map(cleanValue)
      .filter(Boolean)
      .join(", ");
  }

  if (districts && typeof districts === "object") {
    return Object.values(districts).map(cleanValue).filter(Boolean).join(", ");
  }

  return "";
};

export const getCustomerPriceValue = (price: CustomerDisplayLead["max_price"]) => {
  if (typeof price === "number") return Number.isFinite(price) ? price : 0;

  const raw = String(price || "").trim();
  if (!raw) return 0;

  const normalized = normalizeText(raw);
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));

  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric < 1000 && /ty|ti\b/.test(normalized)) return numeric * 1_000_000_000;
    if (numeric < 1000 && /tr|trieu/.test(normalized)) return numeric * 1_000_000;
    return numeric;
  }

  const amountMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(ty|ti|tr|trieu)/);
  if (!amountMatch) return 0;

  const amount = Number(amountMatch[1].replace(",", "."));
  if (!Number.isFinite(amount)) return 0;

  return /ty|ti/.test(amountMatch[2]) ? amount * 1_000_000_000 : amount * 1_000_000;
};

export const formatCustomerBudget = (input: unknown) => {
  const value =
    input && typeof input === "object" && "max_price" in input
      ? (input as CustomerDisplayLead).max_price
      : input;
  const price = getCustomerPriceValue(value as CustomerDisplayLead["max_price"]);

  if (price <= 0) return cleanValue(value) || "Chưa rõ";
  if (price >= 1_000_000_000) {
    return `${(price / 1_000_000_000).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })} tỷ`;
  }

  return `${Math.round(price / 1_000_000).toLocaleString("vi-VN")} triệu`;
};

const parseCustomerNote = (note: string | null | undefined): ParsedCustomerNote => {
  const parsed: ParsedCustomerNote = { freeText: [] };

  if (!note) return parsed;

  for (const part of splitNoteParts(note)) {
    const keyValue = part.match(/^\s*([^:=]+?)\s*[=:]\s*(.+)\s*$/);

    if (keyValue) {
      const rawKey = keyValue[1].trim();
      const value = cleanValue(keyValue[2]);
      const normalizedKey = normalizeKey(rawKey);

      if (RAW_BLOCK_KEYS.test(normalizedKey) || isRawMachineValue(value)) {
        continue;
      }

      const displayKey: ParsedScalarKey | undefined =
        NOTE_KEY_ALIASES[normalizedKey] ||
        (normalizedKey.includes("business") || normalizedKey.includes("use_case")
          ? "business"
          : normalizedKey.includes("location") || normalizedKey.includes("district")
            ? "location"
            : undefined);

      if (displayKey && value) {
        parsed[displayKey] = value;
      }

      continue;
    }

    if (!isRawMachineValue(part)) {
      parsed.freeText.push(cleanValue(part));
    }
  }

  return parsed;
};

const inferMainNeed = (lead: CustomerDisplayLead, parsed: ParsedCustomerNote) => {
  const source = cleanValue(parsed.business || parsed.need || parsed.purpose || parsed.freeText[0]);
  const normalized = normalizeText(source);

  if (/mat bang|\bmb\b|showroom|shop|kinh doanh|business/.test(normalized)) {
    return "Mặt bằng kinh doanh";
  }

  if (/van phong|office/.test(normalized)) return "Văn phòng";
  if (/spa|salon|nail/.test(normalized)) return "Mặt bằng spa/salon";
  if (/cafe|coffee|ca phe/.test(normalized)) return "Mặt bằng cafe";
  if (/nha o|de o|o lau dai|gia dinh/.test(normalized)) return "Nhà ở";
  if (/can ho|chung cu|apartment/.test(normalized)) return "Căn hộ";
  if (/nha nguyen can|nguyen can/.test(normalized)) return "Nhà nguyên căn";

  return titleCaseVietnamese(source) || (lead.max_price ? "Khách thuê/mua nhà" : "Nhu cầu đang cập nhật");
};

export const getCustomerMainNeed = (lead: CustomerDisplayLead) =>
  inferMainNeed(lead, parseCustomerNote(lead.note));

export const getCustomerNeedTags = (lead: CustomerDisplayLead) => {
  const parsed = parseCustomerNote(lead.note);
  const tags = [
    parsed.location || formatCustomerDistricts(lead.preferred_districts),
    parsed.budget || (lead.max_price ? `≤ ${formatCustomerBudget(lead.max_price)}` : ""),
    parsed.width ? `Ngang ${parsed.width.replace(/^ngang\s*/i, "")}` : "",
    parsed.area ? `Diện tích ${parsed.area.replace(/^dien tich\s*/i, "")}` : "",
    parsed.frontage,
    parsed.neededTime,
  ]
    .map(cleanValue)
    .filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 4);
};

export const getCustomerAISummary = (lead: CustomerDisplayLead) => {
  const parsed = parseCustomerNote(lead.note);
  const mainNeed = getCustomerMainNeed(lead).toLowerCase();
  const location = parsed.location || formatCustomerDistricts(lead.preferred_districts);
  const budget = parsed.budget || (lead.max_price ? formatCustomerBudget(lead.max_price) : "");
  const summary = [
    location
      ? `Khách cần thuê ${mainNeed} tại ${location}.`
      : `Khách đang tìm ${mainNeed}.`,
    budget ? `Ngân sách khoảng ${budget}/tháng.` : "",
    parsed.width ? `Ưu tiên mặt tiền ngang ${parsed.width.replace(/^ngang\s*/i, "")}.` : "",
    parsed.purpose ? `Mục đích ${parsed.purpose}.` : parsed.business ? `Mục đích ${parsed.business}.` : "",
    parsed.neededTime ? `Muốn nhận nhà ${parsed.neededTime}.` : "",
  ].filter(Boolean);

  if (summary.length >= 3) return summary.slice(0, 5);

  return [
    ...summary,
    "Nên xác nhận thêm thời gian xem nhà và tiêu chí bắt buộc.",
  ].slice(0, 5);
};

export const getCustomerRequirementDetails = (
  lead: CustomerDisplayLead
): CustomerRequirementDetails => {
  const parsed = parseCustomerNote(lead.note);

  return {
    propertyType: getCustomerMainNeed(lead),
    location: parsed.location || formatCustomerDistricts(lead.preferred_districts) || "Chưa rõ",
    budget: parsed.budget || formatCustomerBudget(lead.max_price),
    width: parsed.width || "Chưa rõ",
    area: parsed.area || "Chưa rõ",
    purpose: parsed.purpose || parsed.business || parsed.need || "Chưa rõ",
    neededTime: parsed.neededTime || "Chưa rõ",
    extraNote: parsed.extraNote || parsed.freeText.slice(0, 2).join(" | ") || "Không có",
  };
};

export const getCustomerSource = (lead: CustomerDisplayLead) =>
  parseCustomerNote(lead.note).source || "Website/AI chat";

export const getCustomerFollowUpText = (lead: CustomerDisplayLead) =>
  parseCustomerNote(lead.note).followUpDate || parseCustomerNote(lead.note).neededTime || "";
