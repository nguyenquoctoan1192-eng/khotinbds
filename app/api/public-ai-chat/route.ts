import { NextResponse } from "next/server";
import {
  detectConversationStage,
  selectPlaybook,
  type ConversationStage,
  type PlaybookId,
  type PlaybookSelection,
} from "@/lib/playbooks";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type PublicChatProfile = {
  name: string | null;
  phone: string | null;
  purpose: string | null;
  business_type: string | null;
  business: string | null;
  location: string | null;
  budget: string | null;
  area: string | null;
  structure: string | null;
  frontage: string | null;
  move_in_time: string | null;
  stage: ConversationStage | null;
};

type PropertySuggestion = {
  area_label: string;
  structure_label: string;
  price_label: string;
  comment_label: string;
};

type ChatResult = {
  reply: string;
  reply_parts: string[];
  suggestion_followup_parts: string[];
  profile: PublicChatProfile;
  conversation_stage: ConversationStage;
  detected_intent: PlaybookId | null;
  playbook_id: PlaybookId | null;
  next_best_question: string;
  suggested_reply: string;
  property_suggestions: PropertySuggestion[];
  ready_to_save: boolean;
  lead_created: boolean;
  lead?: unknown;
};

type PublicChatRequirementKey = Exclude<keyof PublicChatProfile, "stage">;

const profileKeys: PublicChatRequirementKey[] = [
  "purpose",
  "business_type",
  "business",
  "location",
  "budget",
  "area",
  "structure",
  "frontage",
  "move_in_time",
  "phone",
  "name",
];

const profileLabels: Record<keyof PublicChatProfile, string> = {
  name: "name",
  phone: "phone",
  purpose: "purpose",
  business_type: "business type",
  business: "business/use case",
  location: "location/district",
  budget: "budget",
  area: "area",
  structure: "structure",
  frontage: "frontage",
  move_in_time: "move-in/rental time",
  stage: "conversation stage",
};

const emptyProfile = (): PublicChatProfile => ({
  name: null,
  phone: null,
  purpose: null,
  business_type: null,
  business: null,
  location: null,
  budget: null,
  area: null,
  structure: null,
  frontage: null,
  move_in_time: null,
  stage: null,
});

const compactString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const canonicalDistricts = [
  ...Array.from({ length: 12 }, (_, index) => ({
    label: `Quận ${index + 1}`,
    aliases: [`quan ${index + 1}`, `q${index + 1}`, `q. ${index + 1}`, `q.${index + 1}`],
  })),
  { label: "Quận Phú Nhuận", aliases: ["quan phu nhuan", "phu nhuan"] },
  { label: "Quận Bình Thạnh", aliases: ["quan binh thanh", "binh thanh"] },
  { label: "Quận Gò Vấp", aliases: ["quan go vap", "go vap"] },
  { label: "Quận Tân Bình", aliases: ["quan tan binh", "tan binh"] },
  { label: "Quận Tân Phú", aliases: ["quan tan phu", "tan phu"] },
  { label: "TP Thủ Đức", aliases: ["tp thu duc", "thanh pho thu duc", "quan thu duc", "thu duc"] },
  { label: "Quận Bình Tân", aliases: ["quan binh tan", "binh tan"] },
  { label: "Huyện Nhà Bè", aliases: ["huyen nha be", "nha be"] },
  { label: "Huyện Hóc Môn", aliases: ["huyen hoc mon", "hoc mon"] },
  { label: "Huyện Bình Chánh", aliases: ["huyen binh chanh", "binh chanh"] },
  { label: "Huyện Củ Chi", aliases: ["huyen cu chi", "cu chi"] },
  { label: "Huyện Cần Giờ", aliases: ["huyen can gio", "can gio"] },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSpaces = (value: string) => value.replace(/\s+/g, " ").trim();

const extractDistrict = (text: string) => {
  const normalized = normalizeSpaces(normalizeText(text).replace(/\./g, ". "));

  for (let district = 1; district <= 12; district += 1) {
    const pattern = new RegExp(`\\b(?:quan\\s*${district}|q\\.?\\s*${district})\\b`);
    if (pattern.test(normalized)) return `Quận ${district}`;
  }

  for (const district of canonicalDistricts.slice(12)) {
    if (
      district.aliases.some((alias) =>
        new RegExp(`\\b${escapeRegExp(normalizeSpaces(alias))}\\b`).test(normalized)
      )
    ) {
      return district.label;
    }
  }

  return null;
};

const toNumber = (value: string) => Number(value.replace(",", "."));

const extractDimensions = (text: string) => {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:ngang|rong|mat tien)\s*(\d+(?:[.,]\d+)?)\s*m?\s*(?:dai|sau)\s*(\d+(?:[.,]\d+)?)\s*m?/,
    /\b(\d+(?:[.,]\d+)?)\s*m?\s*x\s*(\d+(?:[.,]\d+)?)\s*m?\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const width = toNumber(match[1]);
    const length = toNumber(match[2]);

    if (Number.isFinite(width) && Number.isFinite(length) && width > 0 && length > 0) {
      return {
        width,
        length,
        area: width * length,
        label: `ngang ${match[1].replace(",", ".")} dài ${match[2].replace(",", ".")}`,
      };
    }
  }

  return null;
};

const extractBudget = (text: string) => {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  const matches = Array.from(
    normalized.matchAll(/(?:gia|ngan sach|tam|khoang|duoi|toi da)?\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti|k)?\b/g)
  );

  for (const match of matches) {
    const amount = toNumber(match[1]);
    const unit = match[2] || "";

    if (!Number.isFinite(amount)) continue;
    if (unit === "tr" || unit === "trieu") return String(Math.round(amount * 1000000));
    if (unit === "ty" || unit === "ti") return String(Math.round(amount * 1000000000));
    if (unit === "k") return String(Math.round(amount * 1000));
    if (amount >= 1000000) return String(Math.round(amount));
  }

  return null;
};

const extractBusiness = (text: string) => {
  const normalized = normalizeText(text);

  if (/\bmb\b|mat bang|mat bang kinh doanh|thue mat bang|tim mat bang/.test(normalized)) {
    return "mặt bằng kinh doanh";
  }

  if (/studio|kinh doanh|mo tiem|ban hang|shop|showroom|spa|cafe|ca phe|quan an|nha hang|restaurant/.test(normalized)) {
    return text.match(/studio|spa|cafe|cà phê|ca phe|office|văn phòng|van phong|restaurant|quán ăn|quan an|nhà hàng|nha hang|shop|showroom|kinh doanh|mở tiệm|mo tiem|bán hàng|ban hang/i)?.[0] || "kinh doanh";
  }

  if (/\bo\b|de o|o gia dinh|can ho|nha o/.test(normalized)) {
    return "để ở";
  }

  return null;
};

const extractPurpose = (text: string) => {
  const normalized = normalizeText(text);

  if (
    /(?:khong|khong phai|khong em|doi lai|chuyen sang|chuyen qua).*(?:nha o|de o|o gia dinh|can ho)|\b(?:nha o|de o|o gia dinh|can ho)\b/.test(
      normalized
    )
  ) {
    return "nhà ở";
  }

  if (/\bmb\b|mat bang|kinh doanh|mo tiem|ban hang|shop|showroom|spa|cafe|ca phe|studio|office|van phong|quan an|nha hang|restaurant/.test(normalized)) {
    return "kinh doanh";
  }

  return null;
};

const extractBusinessType = (text: string) => {
  const normalized = normalizeText(text);

  if (/spa|nail|salon|tham my|massage/.test(normalized)) return "spa";
  if (/cafe|ca phe|coffee/.test(normalized)) return "cafe";
  if (/studio/.test(normalized)) return "studio";
  if (/office|van phong|cong ty/.test(normalized)) return "office";
  if (/restaurant|nha hang|quan an|an uong/.test(normalized)) return "quán ăn";
  if (/shop|showroom/.test(normalized)) return text.match(/shop|showroom/i)?.[0] || "shop";

  return null;
};

const formatBudgetForReply = (budget: string | null) => {
  if (!budget) return null;
  const amount = Number(budget);

  if (Number.isFinite(amount)) {
    if (amount >= 1000000000) return `${amount / 1000000000} tỷ`;
    if (amount >= 1000000) return `${amount / 1000000}tr`;
  }

  return budget;
};

const isGenericBusiness = (business: string | null) =>
  Boolean(business && /mặt bằng kinh doanh|mat bang kinh doanh|kinh doanh/i.test(business));

const needsBusinessType = (profile: PublicChatProfile) =>
  profile.purpose === "kinh doanh" && !profile.business_type;

const asksForKnownField = (reply: string, profile: PublicChatProfile) => {
  const normalized = normalizeText(reply);

  return Boolean(
    (profile.location && /(khu vuc|quan nao|o dau|vi tri nao|location)/.test(normalized)) ||
      (profile.budget && /(ngan sach|gia khoang bao nhieu|bao nhieu mot thang|budget)/.test(normalized)) ||
      (profile.area && /(dien tich|bao nhieu met vuong|m2|area)/.test(normalized)) ||
      (profile.purpose && /(de o hay kinh doanh|mua de o|kinh doanh hay de o|purpose)/.test(normalized)) ||
      (profile.purpose === "nhà ở" && /(kinh doanh gi|nganh gi|business)/.test(normalized)) ||
      (profile.business_type &&
        /(kinh doanh gi|nganh gi|de o hay kinh doanh|business)/.test(normalized))
  );
};

const violatesPublicTone = (reply: string) => {
  const normalized = normalizeText(reply);

  return /da em thay hien minh dang|em da luu|em ghi nhan|doi ngu tu van|toi da ghi nhan|toi da hieu|vui long cung cap|xin cho biet/.test(
    normalized
  );
};

const violatesQuestionRule = (reply: string) => {
  const questionCount = (reply.match(/\?/g) || []).length;
  return questionCount !== 1;
};

const repeatsProfileTooMuch = (reply: string, profile: PublicChatProfile) => {
  if (!profile.phone && hasEnoughToAskPhone(profile)) return false;

  const normalizedReply = normalizeText(reply);
  const knownValues = [
    profile.purpose,
    profile.business_type,
    profile.location,
    formatBudgetForReply(profile.budget) || profile.budget,
    profile.area,
    profile.structure,
    profile.frontage,
    profile.move_in_time,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(String(value)));

  const repeatedCount = knownValues.filter((value) => value && normalizedReply.includes(value)).length;

  return repeatedCount >= 3;
};

const mergeProfiles = (...profiles: Partial<PublicChatProfile>[]): PublicChatProfile =>
  profiles.reduce<PublicChatProfile>((merged, profile) => {
    for (const key of profileKeys) {
      if (profile[key]) {
        merged[key] = profile[key] || null;
      }
    }

    if (profile.stage) {
      merged.stage = profile.stage;
    }

    return merged;
  }, emptyProfile());

const extractProfile = (text: string, existing: Partial<PublicChatProfile>) => {
  const profile = mergeProfiles(existing);
  const normalized = normalizeText(text);
  const phoneMatch = text.match(/(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/);
  const budgetMatch = text.match(/(?:\d+(?:[.,]\d+)?\s*(?:tr|triệu|trieu|tỷ|ty|tỉ|ti)|\d{7,})/i);
  const areaMatch = text.match(/\d+\s*m(?:2|²)/i);
  const businessMatch = text.match(/\b(spa|cafe|cà phê|office|văn phòng|restaurant|nhà hàng|shop|showroom|kinh doanh|ở|để ở|mở tiệm|bán hàng)\b/i);
  const structureMatch = text.match(/(?:\d+\s*(?:phòng|pn|wc|tầng|lầu)|trệt|lửng|sân thượng)/i);
  const moveInMatch = text.match(/(?:tháng này|tháng sau|tuần này|tuần sau|vào ở ngay|nhận nhà ngay|đầu tháng|cuối tháng|\d{1,2}\/\d{1,2})/i);
  const locationMatch = text.match(/(?:bình thạnh|phú nhuận|gò vấp|tân bình|thủ đức|quận\s*\d+|q\.\s*\d+|quận\s*[^\s,.;]+)/i);
  const nameMatch = text.match(/(?:tôi tên|mình tên|em tên|anh tên|chị tên|tên là)\s+([A-Za-zÀ-ỹ\s]{2,30})/i);

  const extractedBudget = extractBudget(text);
  const extractedBusiness = extractBusiness(text);
  const extractedPurpose = extractPurpose(text);
  const extractedBusinessType = extractBusinessType(text);
  const extractedDistrict = extractDistrict(text);
  const dimensions = extractDimensions(text);
  const businessDetailMatch = text.match(/(?:đậu xe|dau xe|parking|bãi xe|bai xe|thang máy|thang may|cách âm|cach am|riêng tư|rieng tu|thoát mùi|thoat mui|bếp|bep|đông người|dong nguoi|khách đi bộ|khach di bo|foot traffic)/i);
  const occupancyMatch = text.match(/\d+\s*(?:người|nguoi|khách|khach|chỗ|cho|seat|seats|team|nhân viên|nhan vien)/i);

  if (!profile.phone && phoneMatch) profile.phone = phoneMatch[0].replace(/\D/g, "");
  if (extractedPurpose) {
    profile.purpose = extractedPurpose;
    if (extractedPurpose === "nhà ở") {
      profile.business_type = null;
      profile.business = "nhà ở";
    }
  }
  if (extractedBusinessType) {
    profile.purpose = "kinh doanh";
    profile.business_type = extractedBusinessType;
    profile.business = extractedBusinessType;
  }
  if (extractedBudget) profile.budget = extractedBudget;
  if (!profile.budget && budgetMatch) profile.budget = budgetMatch[0];
  if (!profile.area && areaMatch) profile.area = areaMatch[0];
  if (extractedBusiness && !extractedBusinessType && profile.purpose !== "nhà ở") profile.business = extractedBusiness;
  if (!profile.business && businessMatch) profile.business = businessMatch[0];
  if (!profile.structure && structureMatch) profile.structure = structureMatch[0];
  if (!profile.move_in_time && moveInMatch) profile.move_in_time = moveInMatch[0];
  if (extractedDistrict) profile.location = extractedDistrict;
  if (!profile.location && locationMatch) profile.location = locationMatch[0];
  if (!profile.name && nameMatch?.[1]) profile.name = nameMatch[1].trim();

  if (dimensions) {
    profile.area = String(dimensions.area);
    if (!profile.structure || /ngang|dai|dài|x/i.test(profile.structure)) {
      profile.structure = dimensions.label;
    }
  }

  if (!profile.business && /thue|thuê|mua|can|cần/.test(normalized)) {
    const businessSentence = text.match(/[^.?!]*(?:thuê|mua|cần|kinh doanh|mở)[^.?!]*/i);
    if (businessSentence) profile.business = businessSentence[0].trim();
  }

  if (profile.business_type && !profile.purpose) {
    profile.purpose = "kinh doanh";
  }

  const frontageMatch = text.match(/(?:mặt tiền|mat tien|hẻm|hem|ô tô|o to|oto|xe hơi|xe hoi|đường lớn|duong lon)/i);
  if (frontageMatch) {
    profile.frontage = frontageMatch[0];
  }

  if (!profile.frontage && businessDetailMatch) {
    profile.frontage = businessDetailMatch[0];
  }

  if (!profile.structure && businessDetailMatch && /bep|bếp/.test(normalizeText(businessDetailMatch[0]))) {
    profile.structure = businessDetailMatch[0];
  }

  if (!profile.structure && occupancyMatch) {
    profile.structure = occupancyMatch[0];
  }

  const latestLocationMatch = text.match(/(?:chuyển sang|chuyen sang|qua|sang)\s+([^,.;\n]+)/i);
  if (latestLocationMatch?.[1]) {
    profile.location = extractDistrict(latestLocationMatch[1]) || latestLocationMatch[1].trim();
  }

  return profile;
};

const getMissingRequirements = (profile: PublicChatProfile) =>
  profileKeys.filter((key) => !profile[key]).map((key) => profileLabels[key]);

const isReadyToSave = (profile: PublicChatProfile) =>
  Boolean(
    profile.location &&
      profile.purpose &&
      profile.budget &&
      profile.phone
  );

const hasEnoughToAskPhone = (profile: PublicChatProfile) =>
  Boolean(
    profile.location &&
      profile.purpose &&
      profile.budget
  );

const summarizeKnownV2 = (profile: PublicChatProfile) => {
  const parts = [
    profile.purpose ? `${profile.purpose}` : "",
    profile.business_type ? `${profile.business_type}` : "",
    profile.location ? `ở ${profile.location}` : "",
    profile.budget ? `khoảng ${formatBudgetForReply(profile.budget) || profile.budget}` : "",
    profile.area ? `tầm ${profile.area}m2` : "",
    profile.structure ? `kết cấu ${profile.structure}` : "",
    profile.frontage ? `${profile.frontage}` : "",
    profile.move_in_time ? `nhận nhà ${profile.move_in_time}` : "",
  ].filter(Boolean);

  return parts.length ? `Em thấy nhu cầu của mình đang là ${parts.join(", ")}.` : "";
};

const summarizeForPhoneAsk = (profile: PublicChatProfile) => {
  const parts = [
    profile.purpose || "",
    profile.business_type || "",
    profile.location ? `khu ${profile.location}` : "",
    profile.budget ? `tầm ${formatBudgetForReply(profile.budget) || profile.budget}` : "",
  ].filter(Boolean);

  return parts.length
    ? `Vậy là mình đang tìm ${parts.join(", ")}, em có thể gửi vài lựa chọn sát hơn cho anh.`
    : "Em có thể gửi vài lựa chọn sát hơn cho anh.";
};

const reactionFor = (message: string, profile: PublicChatProfile) => {
  const normalized = normalizeText(message);

  if (/studio/.test(normalized)) return "Dạ studio thì em hiểu hướng mình cần rồi anh.";
  if (/mat tien/.test(normalized)) return "Dạ ok anh, em ưu tiên mặt tiền cho mình nhé.";
  if (/tret|lau|tang|lung|phong|pn|wc/.test(normalized)) {
    return `Dạ ${profile.structure || "kết cấu đó"} thì khá ổn anh.`;
  }
  if (/ngang|dai|m2|\d+\s*x\s*\d+/.test(normalized)) {
    return "Dạ kích thước vậy lọc mặt bằng sẽ sát hơn anh.";
  }
  if (/tr|trieu|ty|ti|ngan sach|gia/.test(normalized)) {
    return "Dạ với ngân sách này vẫn có lựa chọn đó anh.";
  }
  if (/quan|q\.?\s*\d+|phu nhuan|binh thanh|go vap|tan binh|tan phu|thu duc/.test(normalized)) {
    return "Dạ khu vực đó em thấy ổn để bắt đầu lọc anh.";
  }
  if (/khong|chua|tu van|gui|xem them/.test(normalized)) {
    return "Dạ không sao anh, mình cứ trao đổi thêm để em lọc đúng hơn.";
  }

  return "Dạ anh.";
};

const businessKind = (profile: PublicChatProfile) => {
  const normalized = normalizeText(profile.business_type || profile.business || "");

  if (/spa|nail|salon|tham my|massage/.test(normalized)) return "spa";
  if (/cafe|ca phe|coffee/.test(normalized)) return "cafe";
  if (/studio/.test(normalized)) return "studio";
  if (/office|van phong|cong ty/.test(normalized)) return "office";
  if (/restaurant|nha hang|quan an|an uong/.test(normalized)) return "restaurant";

  return null;
};

const businessSpecificQuestion = (profile: PublicChatProfile) => {
  const kind = businessKind(profile);
  const detailText = normalizeText(
    [profile.frontage, profile.structure, profile.move_in_time].filter(Boolean).join(" ")
  );

  if (!kind) return null;

  if (kind === "spa") {
    if (!profile.frontage) return "Spa của mình có cần mặt tiền dễ thấy không anh?";
    if (!profile.structure) return "Mình cần khoảng mấy phòng làm dịch vụ ạ?";
    if (!/dau xe|parking|bai xe/.test(detailText)) {
      return "Khách tới spa mình có cần chỗ đậu xe thuận tiện không anh?";
    }
    return null;
  }

  if (kind === "cafe") {
    if (!profile.frontage) return "Cafe mình có ưu tiên mặt tiền đông người qua lại không anh?";
    if (!profile.area) return "Mình muốn sức chứa khoảng bao nhiêu khách ạ?";
    if (!/dong nguoi|khach di bo|foot traffic/.test(detailText)) {
      return "Mình cần khu có lượng khách đi bộ tốt hay chủ yếu khách quen ạ?";
    }
    return null;
  }

  if (kind === "studio") {
    if (!profile.area) return "Studio mình cần không gian mở khoảng bao nhiêu mét vuông ạ?";
    if (!profile.structure) return "Mình cần chia mấy phòng riêng cho studio không anh?";
    if (!/cach am|rieng tu/.test(detailText)) {
      return "Studio của mình có cần cách âm hoặc riêng tư nhiều không ạ?";
    }
    return null;
  }

  if (kind === "office") {
    if (!profile.area) return "Văn phòng mình khoảng bao nhiêu người làm việc anh?";
    if (!profile.frontage) return "Mình có cần chỗ đậu xe thuận tiện cho team không ạ?";
    if (!/thang may/.test(detailText)) {
      return "Văn phòng mình có cần thang máy không anh?";
    }
    return null;
  }

  if (kind === "restaurant") {
    if (!profile.structure) return "Quán mình có cần khu bếp riêng rộng không anh?";
    if (!profile.frontage) return "Mình có ưu tiên mặt tiền dễ thấy cho quán không ạ?";
    if (!/thoat mui/.test(detailText)) {
      return "Mô hình quán của mình có cần thoát mùi tốt không anh?";
    }
    return null;
  }

  return null;
};

const nextQuestionForV2 = (profile: PublicChatProfile) => {
  if (!profile.purpose) {
    return "Mình đang tìm để ở hay để kinh doanh vậy anh?";
  }

  if (needsBusinessType(profile)) {
    return "Anh làm ngành gì để em lọc mặt bằng sát hơn ạ?";
  }

  if (!profile.location) {
    return "Mình ưu tiên khu vực nào nhất anh/chị nhỉ?";
  }

  if (!profile.budget) {
    return "Ngân sách mình muốn giữ khoảng bao nhiêu một tháng ạ?";
  }

  if (!profile.phone && hasEnoughToAskPhone(profile)) {
    return `${summarizeForPhoneAsk(profile)}\n\nAnh cho em xin Zalo hoặc số điện thoại nhé, em gửi hình và các căn phù hợp cho mình xem trước.`;
  }

  const tailoredQuestion = businessSpecificQuestion(profile);

  if (tailoredQuestion) {
    return tailoredQuestion;
  }

  if (!profile.area) {
    return "Em hỏi thêm chút, mình cần khoảng bao nhiêu mét vuông anh/chị nhỉ?";
  }

  if (!profile.structure) {
    return "Mình cần kết cấu khoảng mấy phòng hoặc mấy tầng ạ?";
  }

  if (!profile.frontage) {
    return "Mình có cần mặt tiền, hẻm xe hơi hay đường lớn không ạ?";
  }

  if (!profile.move_in_time) {
    return "Mình dự kiến cần nhận nhà hoặc bắt đầu thuê khi nào ạ?";
  }

  if (!profile.name) {
    return "Em tiện xưng hô với mình thế nào ạ?";
  }

  return "Anh/chị còn tiêu chí nào muốn em lưu ý thêm không ạ?";
};

const fallbackReplyV2 = (message: string, profile: PublicChatProfile) => {
  const reaction = reactionFor(message, profile);
  const shouldAskPhone = !profile.phone && hasEnoughToAskPhone(profile);
  const question = nextQuestionForV2(profile);

  if (shouldAskPhone) {
    return `${reaction}\n\n${question}`;
  }

  const helpfulComment =
    profile.location && profile.budget
      ? "Tầm này em có thể lọc trước vài căn phù hợp cho mình."
      : "Mình cứ nói nhu cầu tự nhiên, em sẽ lọc dần cho sát anh.";

  return `${reaction}\n\n${helpfulComment}\n\n${question}`;
};

const getConversationStage = (
  profile: PublicChatProfile,
  intent: PlaybookId | null,
  hasPropertySuggestions: boolean
): ConversationStage => {
  return detectConversationStage(profile, intent, hasPropertySuggestions);
};

const buildSummary = (history: ChatMessage[], profile: PublicChatProfile) => {
  const summaryParts = profileKeys
    .filter((key) => profile[key])
    .map((key) => `${profileLabels[key]}=${profile[key]}`);
  const latestMessages = history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join(" / ");

  return [
    "Nguồn: AI Chat",
    summaryParts.length ? `Hồ sơ: ${summaryParts.join(" | ")}` : "",
    latestMessages ? `Tóm tắt hội thoại: ${latestMessages}` : "",
    profile.location ? `Khu vực phụ trách tạm thời: ${profile.location}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
};

const parseBudgetValue = (budget: string | null) => {
  if (!budget) return null;

  const normalized = normalizeText(budget).replace(/\./g, "").replace(/,/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);

  if (!match) return null;

  const amount = Number(match[1]);

  if (!Number.isFinite(amount)) return null;
  if (/tr|trieu/.test(normalized)) return amount * 1000000;
  if (/ty|ti/.test(normalized)) return amount * 1000000000;

  return amount;
};

const parseAreaValue = (area: string | null) => {
  if (!area) return null;

  const match = area.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const formatListingPrice = (price: unknown) => {
  const value = Number(price || 0);
  const formatAmount = (amount: number) =>
    Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(1).replace(/\.0$/, "");

  if (!Number.isFinite(value) || value <= 0) return "Liên hệ";
  if (value >= 1000000000) return `${formatAmount(value / 1000000000)} tỷ`;
  if (value >= 1000000) return `${formatAmount(value / 1000000)}tr`;

  return value.toLocaleString("vi-VN");
};

const removePublicAddressPrefixes = (value: string) =>
  value
    .replace(/\b(?:góc\s*mt|goc\s*mt|2\s*mt|hxh|hxt|h3g|mb|mt)\b/gi, " ")
    .replace(/\b(?:hẻm|hem)\s*(?=\d+[a-z]?\s*\/)/gi, " ");

const removePublicExactNumbers = (value: string) => {
  let cleaned = value
    .replace(/\b\d+[a-z]?(?:\s*[/-]\s*\d+[a-z]?)+\b/gi, " ")
    .replace(/^\s*\d+[a-z]?\s*\/+\s*/i, "")
    .replace(/^\s*(?:hẻm|hem)\s+\d+[a-z]?(?:\s*[/-]\s*\d+[a-z]?)*\s*/i, "");

  if (!/^\s*\d+\s+(?:tháng|thang)\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/^\s*(?:số|so)?\s*\d+[a-z]?\s+/i, "");
  }

  return normalizeSpaces(cleaned);
};

const detectPublicAddressPrefix = (address: string) => {
  const normalized = normalizeText(address);

  if (/\bgoc\s*mt\b/.test(normalized)) return "Góc MT";
  if (/\b2\s*mt\b/.test(normalized)) return "2MT";
  if (/\bhxh\b/.test(normalized)) return "HXH";
  if (/\bhxt\b/.test(normalized)) return "HXT";
  if (/\bh3g\b/.test(normalized)) return "H3G";
  if (/\bmt\b/.test(normalized)) return "MT";

  return null;
};

const formatPublicSuggestionArea = (
  rawAddress: unknown,
  rawDistrict: unknown,
  rawTitle: unknown,
  rawDescription: unknown
) => {
  const address = compactString(rawAddress) || "";
  const district = compactString(rawDistrict) || "";
  const title = compactString(rawTitle) || "";
  const description = compactString(rawDescription) || "";
  const combined = normalizeText(`${title} ${address} ${description}`);
  const hasMb = /\bmb\b/.test(combined);
  const hasSlash = address.includes("/");
  const explicitPrefix = detectPublicAddressPrefix(`${address} ${title} ${description}`);
  const prefix = hasMb
    ? `MB ${hasSlash ? "Hẻm" : "Mặt tiền"}`
    : explicitPrefix || (hasSlash ? "Hẻm" : "Mặt tiền");
  const street = address
    .split(",")
    .map(removePublicAddressPrefixes)
    .map(removePublicExactNumbers)
    .find((part) => part && /[A-Za-zÀ-ỹ]/.test(part));

  if (!street && district) return `${prefix} ${district}`;
  if (!street) return "Khu vực phù hợp";

  const normalizedStreet = normalizeText(street);
  const normalizedDistrict = normalizeText(district)
    .replace(/\b(?:quan|q)\.?\s*/g, "")
    .trim();
  const shouldAppendDistrict =
    district && normalizedDistrict && !normalizedStreet.includes(normalizedDistrict);

  return `${prefix} ${street}${shouldAppendDistrict ? `, ${district}` : ""}`;
};

const pushUnique = (items: string[], value: string | null) => {
  if (value && !items.some((item) => normalizeText(item) === normalizeText(value))) {
    items.push(value);
  }
};

const formatPublicStructure = (
  rawTitle: unknown,
  rawAddress: unknown,
  rawDescription: unknown,
  rawArea: unknown
) => {
  const source = [rawTitle, rawAddress, rawDescription]
    .map((value) => compactString(value))
    .filter(Boolean)
    .join(" ");
  const normalized = normalizeText(source);
  const parts: string[] = [];
  const dimension =
    source.match(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/i)?.[0] ||
    normalized
      .match(/(?:ngang|rong|mat tien)\s*(\d+(?:[.,]\d+)?)\s*m?\s*(?:dai|sau)\s*(\d+(?:[.,]\d+)?)/)
      ?.slice(1, 3)
      .join("x")
      .replace(/,/g, ".");

  pushUnique(parts, dimension || null);

  if (/\b(?:tret|trệt)\b/i.test(source)) pushUnique(parts, "trệt");

  const floorMatch =
    source.match(/\b\d+\s*(?:lầu|lau)\b/i)?.[0] ||
    source.match(/\b\d+\s*(?:tầng|tang)\b/i)?.[0];
  pushUnique(parts, floorMatch || null);

  if (/\b(?:st|sân thượng|san thuong)\b/i.test(source)) pushUnique(parts, "ST");

  const bedroomMatch = source.match(/\b\d+\s*PN\b/i)?.[0] || source.match(/\b\d+\s*(?:phòng ngủ|phong ngu)\b/i)?.[0];
  pushUnique(parts, bedroomMatch ? bedroomMatch.replace(/\s+/g, "") : null);

  const bathroomMatch = source.match(/\b\d+\s*WC\b/i)?.[0];
  pushUnique(parts, bathroomMatch ? bathroomMatch.replace(/\s+/g, "") : null);

  if (/\bCHDV\b/i.test(source)) pushUnique(parts, "CHDV");
  if (/\bTM\b/i.test(source)) pushUnique(parts, "TM");
  if (/\b(?:full\s*nt|full nội thất|full noi that)\b/i.test(source)) pushUnique(parts, "Full NT");

  if (parts.length > 0) return parts.join(" ");

  const area = Number(rawArea || 0);
  if (Number.isFinite(area) && area > 0) {
    return `${Number.isInteger(area) ? area : area.toFixed(1).replace(/\.0$/, "")}m²`;
  }

  return "Đang cập nhật";
};

const buildSuggestionComment = (
  suggestion: Omit<PropertySuggestion, "comment_label">,
  rawArea: unknown,
  profile: PublicChatProfile
) => {
  const profileText = normalizeText([profile.business_type, profile.business, profile.purpose].filter(Boolean).join(" "));
  const areaText = normalizeText(`${suggestion.area_label} ${suggestion.structure_label}`);
  const area = Number(rawArea || 0);

  if (/studio/.test(profileText)) return "phù hợp mở studio";
  if (/spa|nail|salon|tham my|massage/.test(profileText)) return "phù hợp spa";
  if (/cafe|ca phe|coffee|quan an|nha hang|restaurant/.test(profileText)) return "mặt bằng dễ nhận diện";
  if (/nha o|de o|o gia dinh/.test(profileText)) return "phù hợp gia đình ở";
  if (/mat tien|mt|2mt|goc mt/.test(areaText)) return "mặt bằng dễ nhận diện";
  if (Number.isFinite(area) && area >= 80) return "diện tích rộng";

  return "ngân sách tốt";
};

const buildReplyParts = (reply: string, suggestions: PropertySuggestion[]) => {
  const parts = reply
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const safeParts = parts.length > 0 ? parts : [reply.trim()].filter(Boolean);

  if (suggestions.length > 0) {
    const intro = safeParts.find((part) => {
      const normalized = normalizeText(part);
      return (
        !part.includes("?") &&
        !/(zalo|so dien thoai|sdt|cho em xin|gui anh xem|vai can|lua chon)/.test(normalized)
      );
    });

    return [
      intro || "Dạ em lọc được vài lựa chọn khá sát nhu cầu anh.",
      "Em gửi anh xem từng căn, mỗi căn có một điểm mạnh riêng nha.",
    ];
  }

  return safeParts;
};

const buildSuggestionFollowupParts = (
  suggestions: PropertySuggestion[],
  profile: PublicChatProfile
) => {
  if (suggestions.length === 0) return [];

  const compare =
    suggestions.length === 1
      ? "Căn này em thấy gọn nhu cầu, mình có thể xem thêm hình trước rồi quyết định đi thực tế."
      : "So nhanh thì mỗi căn có một lợi thế: có căn mạnh về vị trí, có căn lợi hơn về diện tích hoặc ngân sách.";
  const phoneAsk = profile.phone
    ? "Anh dùng Zalo số này luôn để em gửi thêm hình thực tế và lịch xem cho mình nhé?"
    : "Anh cho em xin Zalo hoặc số điện thoại nhé, em gửi thêm hình thực tế và lọc tiếp căn sát hơn cho mình.";

  return [compare, phoneAsk];
};

const buildListingSuggestions = async (
  req: Request,
  profile: PublicChatProfile
): Promise<PropertySuggestion[]> => {
  if (!profile.location || !profile.budget) return [];

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "match",
      preferred_districts: [profile.location],
      max_price: parseBudgetValue(profile.budget),
      min_area: parseAreaValue(profile.area),
      note: [profile.business_type, profile.purpose].filter(Boolean).join(", ") || null,
    }),
  });

  if (!res.ok) return [];

  const json = await res.json();
  const matches = Array.isArray(json.matches) ? json.matches.slice(0, 3) : [];

  if (matches.length === 0) return [];

  return matches.map((item: any) => {
    const listing = item.listing || item;
    const suggestion = {
      area_label: formatPublicSuggestionArea(
        listing.address,
        listing.district,
        listing.title,
        listing.description
      ),
      structure_label: formatPublicStructure(
        listing.title,
        listing.address,
        listing.description,
        listing.area
      ),
      price_label: formatListingPrice(listing.price),
    };

    return {
      ...suggestion,
      comment_label: buildSuggestionComment(suggestion, listing.area, profile),
    };
  });
};



const buildPrompt = (
  history: ChatMessage[],
  currentMessage: string,
  profile: PublicChatProfile
) => `
You are a public-facing Vietnamese real estate AI consultant.

Behavior:
- Friendly, natural, professional, and concise.
- Ask only one question at a time.
- Do not sound like a form.
- Do not invent missing customer information.
- Gradually collect: name, phone, business/use case, location/district, budget, area, structure, move-in/rental time.
- Never ask again for fields already known in this profile.
- If a question is needed, ask the most important missing field only.

Known extracted profile:
${JSON.stringify(profile, null, 2)}

Conversation history:
${JSON.stringify(history, null, 2)}

Current customer message:
${currentMessage}

Return JSON only:
{
  "reply": "Vietnamese reply",
  "profile": {
    "name": string|null,
    "phone": string|null,
    "purpose": string|null,
    "business_type": string|null,
    "business": string|null,
    "location": string|null,
    "budget": string|null,
    "area": string|null,
    "structure": string|null,
    "move_in_time": string|null
  }
}
`;

const buildPromptV2 = (
  history: ChatMessage[],
  currentMessage: string,
  profile: PublicChatProfile,
  nextQuestion: string,
  playbookSelection: PlaybookSelection
) => `
# SYSTEM PROMPT - AI SALES BẤT ĐỘNG SẢN

Bạn là một chuyên viên môi giới bất động sản có nhiều kinh nghiệm.

Nhiệm vụ của bạn không phải là chatbot thu thập dữ liệu.

Nhiệm vụ của bạn là trò chuyện tự nhiên với khách hàng, xây dựng thiện cảm, hiểu nhu cầu và giúp khách tìm được bất động sản phù hợp.

## Cách nói chuyện

* Xưng hô: anh/chị - em.
* Giọng điệu thân thiện.
* Tự nhiên như người thật.
* Ngắn gọn.
* Không nói kiểu robot.

Không dùng các kiểu câu robot, câu yêu cầu kiểu biểu mẫu, hoặc thông báo rằng hệ thống/đội sale đã lưu lead.

Ưu tiên:

* Dạ anh.
* Dạ chị.
* Em thấy...
* Vậy là...
* Nghe hợp lý anh.
* Cái này khá phù hợp đó anh.

---

## Quy tắc quan trọng nhất

KHÔNG được nhảy thẳng vào câu hỏi.

Mỗi lần khách trả lời, phải theo trình tự:

1. Phản hồi điều khách vừa nói.
2. Tóm tắt những gì đã biết.
3. Hỏi đúng 1 thông tin còn thiếu.

Ví dụ:

Khách:
"1 trệt 2 lầu là được em"

Sai:

"Anh cần bao nhiêu mét vuông?"

Đúng:

"Dạ 1 trệt 2 lầu thì khá ổn anh.

Hiện em đang nắm mình cần mặt bằng Quận 1 khoảng 50 triệu và kết cấu 1 trệt 2 lầu.

Anh cần khoảng bao nhiêu mét vuông để em lọc sát hơn ạ?"

---

## Không hỏi lại

Nếu hệ thống đã biết:

* khu vực
* ngân sách
* diện tích
* kết cấu
* mặt tiền
* thời gian nhận nhà
* ngành nghề

thì KHÔNG được hỏi lại.

Ví dụ:

Đã biết:

location = Quận 1

KHÔNG được hỏi:

"Anh ưu tiên khu vực nào?"

---

## Tập trung vào cuộc trò chuyện

Khách vừa nói gì thì phải phản hồi điều đó trước.

Ví dụ:

Khách:
"Mặt tiền nha em"

Sai:

"Dạ em xem lại nhu cầu của mình..."

Đúng:

"Dạ ok anh, em ưu tiên mặt tiền cho mình nhé."

Sau đó mới tiếp tục.

---

## Một lần chỉ hỏi một thứ

Không được hỏi:

"Anh cần diện tích bao nhiêu, kết cấu thế nào và khi nào nhận nhà?"

Chỉ hỏi:

"Anh cần khoảng bao nhiêu mét vuông ạ?"

## Câu hỏi theo ngành nghề

Khi đã biết ngành nghề, hỏi tự nhiên theo ngành, không hỏi như checklist.

* spa: ưu tiên hỏi lần lượt về mặt tiền, số phòng dịch vụ, chỗ đậu xe.
* cafe: ưu tiên hỏi lần lượt về mặt tiền, lượng người qua lại, sức chứa/chỗ ngồi.
* studio: ưu tiên hỏi lần lượt về không gian mở, số phòng riêng, cách âm/riêng tư.
* office/văn phòng: ưu tiên hỏi lần lượt về số người làm việc, chỗ đậu xe, thang máy.
* restaurant/quán ăn/nhà hàng: ưu tiên hỏi lần lượt về khu bếp, mặt tiền, thoát mùi.

Mỗi lần chỉ chọn một ý phù hợp nhất để hỏi tiếp.

---

## Thứ tự khai thác

Ưu tiên:

1. Loại nhu cầu
2. Khu vực
3. Ngân sách
4. Diện tích
5. Kết cấu
6. Mặt tiền
7. Thời gian nhận nhà
8. Số điện thoại

---

## Xin số điện thoại

KHÔNG xin số điện thoại quá sớm.

Chỉ xin khi đã hiểu:

* khu vực
* ngân sách
* loại nhu cầu

Sau đó nói:

"Dạ em nắm nhu cầu của anh khá rõ rồi.

Anh cho em xin Zalo hoặc số điện thoại nhé, em gửi hình và các căn phù hợp cho mình xem trước."

---

## Nếu khách chưa muốn cho số

Không ép.

Tiếp tục tư vấn.

Tiếp tục khai thác nhu cầu.

---

## Luôn tạo cảm giác đang được một môi giới thật hỗ trợ

Khách phải có cảm giác:

"Người này đang lắng nghe mình"

chứ không phải:

"Mình đang điền form cho chatbot".

---

## Mục tiêu cuối cùng

1. Hiểu đúng nhu cầu.
2. Tạo thiện cảm.
3. Thu lead.
4. Chuyển lead cho sale phụ trách khu vực.
5. Tiếp tục làm giàu dữ liệu CRM trong quá trình trò chuyện.

## Dữ liệu hệ thống đã biết

Profile da biet noi bo:
${JSON.stringify(profile, null, 2)}

Khong hoi lai bat ky truong nao da co gia tri trong profile noi bo.

Câu hỏi tiếp theo nên tập trung vào đúng ý này nếu vẫn còn thiếu:
${nextQuestion}

## Playbook Engine

Intent phat hien:
${playbookSelection.intent || "none"}

Conversation stage:
${playbookSelection.stage}

Playbook dang dung:
${playbookSelection.playbook?.id || "none"}

Skeleton bat buoc giu y chinh:
${playbookSelection.skeleton}

Hay viet lai skeleton cho tu nhien nhu moi gioi that. Khong doi muc tieu cua skeleton. Khong them cau hoi thu hai. Neu skeleton xin Zalo/so dien thoai thi giu dung muc tieu xin lien he.

Lịch sử chat:
${JSON.stringify(history, null, 2)}

Tin nhắn mới nhất của khách:
${currentMessage}

Trả về JSON duy nhất:
{
  "reply": "Một câu trả lời tiếng Việt tự nhiên theo đúng thứ tự: phản hồi điều khách vừa nói, tóm tắt điều đã biết, rồi hỏi đúng 1 thông tin còn thiếu nếu cần",
  "profile": {
    "name": string|null,
    "phone": string|null,
    "purpose": string|null,
    "business_type": string|null,
    "business": string|null,
    "location": string|null,
    "budget": string|null,
    "area": string|null,
    "structure": string|null,
    "frontage": string|null,
    "move_in_time": string|null
  }
}
`;

const parseAiJson = (value: unknown, fallbackProfile: PublicChatProfile) => {
  if (!value || typeof value !== "object") return null;

  const result = value as { reply?: unknown; profile?: Partial<PublicChatProfile> };

  if (typeof result.reply !== "string") return null;

  return {
    reply: result.reply,
    profile: mergeProfiles(fallbackProfile, result.profile || {}),
  };
};

const createLead = async (
  req: Request,
  history: ChatMessage[],
  profile: PublicChatProfile,
  detectedIntent: PlaybookId | null
) => {
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "lead",
      fullname: profile.name || "Khách AI Chat",
      phone: profile.phone,
      preferred_districts: profile.location ? [profile.location] : [],
      max_price: parseBudgetValue(profile.budget),
      min_area: parseAreaValue(profile.area),
      note: buildSummary(history, profile),
      detected_intent: detectedIntent,
    }),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || "Không lưu được khách từ AI Chat.");
  }

  return json.lead;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const history = Array.isArray(body.history)
      ? body.history
          .filter((item: ChatMessage) => item?.role && item?.content)
          .map((item: ChatMessage) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: String(item.content),
          }))
      : [];
    const currentMessage = compactString(body.message) || history.at(-1)?.content || "";

    if (!currentMessage) {
      return NextResponse.json(
        { success: false, error: "Thiếu nội dung chat." },
        { status: 400 }
      );
    }

    const textForExtraction = [...history, { role: "user", content: currentMessage }]
      .map((message) => message.content)
      .join("\n");
    const extractedProfile = extractProfile(
      currentMessage,
      extractProfile(textForExtraction, body.profile || {})
    );
    let nextBestQuestion = nextQuestionForV2(extractedProfile);
    const propertySuggestions = await buildListingSuggestions(req, extractedProfile);
    const playbookSelection = selectPlaybook({
      message: currentMessage,
      profile: extractedProfile,
      hasPropertySuggestions: propertySuggestions.length > 0,
      nextQuestion: nextBestQuestion,
    });
    const baseProfile: PublicChatProfile = {
      ...extractedProfile,
      stage: playbookSelection.stage,
    };
    const apiKey = process.env.OPENAI_API_KEY;
    let reply = playbookSelection.playbook
      ? playbookSelection.skeleton
      : fallbackReplyV2(currentMessage, baseProfile);
    let profile = baseProfile;

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: buildPromptV2(
            history,
            currentMessage,
            baseProfile,
            nextBestQuestion,
            playbookSelection
          ),
          text: {
            format: {
              type: "json_schema",
              name: "public_ai_chat_reply",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  reply: { type: "string" },
                  profile: {
                    type: "object",
                    additionalProperties: false,
                    properties: Object.fromEntries(
                      profileKeys.map((key) => [key, { type: ["string", "null"] }])
                    ),
                    required: profileKeys,
                  },
                },
                required: ["reply", "profile"],
              },
            },
          },
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Không gọi được AI.");
      }

      const outputText =
        json.output_text ||
        json.output?.flatMap((item: any) => item.content || [])
          ?.find((content: any) => content.type === "output_text")?.text ||
        "";
      const parsed = parseAiJson(JSON.parse(outputText), baseProfile);

      if (parsed) {
        reply = parsed.reply;
        profile = extractProfile(
          currentMessage,
          extractProfile(
            `${textForExtraction}\n${Object.values(parsed.profile).filter(Boolean).join("\n")}`,
            parsed.profile
          )
        );
        nextBestQuestion = nextQuestionForV2(profile);
        profile.stage = detectConversationStage(
          profile,
          playbookSelection.intent,
          propertySuggestions.length > 0
        );
        if (
          asksForKnownField(reply, profile) ||
          violatesPublicTone(reply) ||
          violatesQuestionRule(reply) ||
          repeatsProfileTooMuch(reply, profile)
        ) {
          reply = playbookSelection.playbook
            ? playbookSelection.skeleton
            : fallbackReplyV2(currentMessage, profile);
        }
      }
    }

    const readyToSave = isReadyToSave(profile);
    let leadCreated = false;
    let lead: unknown;
    const replyParts = buildReplyParts(reply, propertySuggestions);
    const suggestionFollowupParts = buildSuggestionFollowupParts(propertySuggestions, profile);

    if (readyToSave && !body.lead_created) {
      lead = await createLead(
        req,
        [...history, { role: "user", content: currentMessage }, { role: "assistant", content: reply }],
        profile,
        playbookSelection.intent
      );
      leadCreated = true;
    }

    const result: ChatResult = {
      reply,
      reply_parts: replyParts,
      suggestion_followup_parts: suggestionFollowupParts,
      profile,
      conversation_stage: getConversationStage(
        profile,
        playbookSelection.intent,
        propertySuggestions.length > 0
      ),
      detected_intent: playbookSelection.intent,
      playbook_id: playbookSelection.playbook?.id || null,
      next_best_question: nextQuestionForV2(profile),
      suggested_reply: reply,
      property_suggestions: propertySuggestions,
      ready_to_save: readyToSave,
      lead_created: leadCreated,
      lead,
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không xử lý được AI Chat.",
      },
      { status: 500 }
    );
  }
}
