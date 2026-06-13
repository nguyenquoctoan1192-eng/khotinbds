import { NextResponse } from "next/server";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type PublicChatProfile = {
  name: string | null;
  phone: string | null;
  business: string | null;
  location: string | null;
  budget: string | null;
  area: string | null;
  structure: string | null;
  frontage: string | null;
  move_in_time: string | null;
};

type ChatResult = {
  reply: string;
  profile: PublicChatProfile;
  conversation_stage: "discovery" | "qualification" | "lead_created" | "nurturing";
  known_requirements: PublicChatProfile;
  missing_requirements: string[];
  next_best_question: string;
  suggested_reply: string;
  ready_to_save: boolean;
  lead_created: boolean;
  lead?: unknown;
};

const profileKeys: Array<keyof PublicChatProfile> = [
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
  business: "business/use case",
  location: "location/district",
  budget: "budget",
  area: "area",
  structure: "structure",
  frontage: "frontage",
  move_in_time: "move-in/rental time",
};

const emptyProfile = (): PublicChatProfile => ({
  name: null,
  phone: null,
  business: null,
  location: null,
  budget: null,
  area: null,
  structure: null,
  frontage: null,
  move_in_time: null,
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

  if (/kinh doanh|mo tiem|ban hang|shop|showroom|spa|cafe|ca phe|nha hang|restaurant/.test(normalized)) {
    return text.match(/spa|cafe|cà phê|ca phe|office|văn phòng|van phong|restaurant|nhà hàng|nha hang|shop|showroom|kinh doanh|mở tiệm|mo tiem|bán hàng|ban hang/i)?.[0] || "kinh doanh";
  }

  if (/\bo\b|de o|o gia dinh|can ho|nha o/.test(normalized)) {
    return "để ở";
  }

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

const asksForKnownField = (reply: string, profile: PublicChatProfile) => {
  const normalized = normalizeText(reply);

  return Boolean(
    (profile.location && /(khu vuc|quan nao|o dau|vi tri nao|location)/.test(normalized)) ||
      (profile.budget && /(ngan sach|gia khoang bao nhieu|bao nhieu mot thang|budget)/.test(normalized)) ||
      (profile.area && /(dien tich|bao nhieu met vuong|m2|area)/.test(normalized)) ||
      (profile.business &&
        !isGenericBusiness(profile.business) &&
        /(kinh doanh gi|nganh gi|de o hay kinh doanh|business)/.test(normalized))
  );
};

const mergeProfiles = (...profiles: Partial<PublicChatProfile>[]): PublicChatProfile =>
  profiles.reduce<PublicChatProfile>((merged, profile) => {
    for (const key of profileKeys) {
      if (profile[key]) {
        merged[key] = profile[key] || null;
      }
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
  const extractedDistrict = extractDistrict(text);
  const dimensions = extractDimensions(text);

  if (!profile.phone && phoneMatch) profile.phone = phoneMatch[0].replace(/\D/g, "");
  if (extractedBudget) profile.budget = extractedBudget;
  if (!profile.budget && budgetMatch) profile.budget = budgetMatch[0];
  if (!profile.area && areaMatch) profile.area = areaMatch[0];
  if (extractedBusiness) profile.business = extractedBusiness;
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

  const frontageMatch = text.match(/(?:mặt tiền|mat tien|hẻm|hem|ô tô|o to|oto|xe hơi|xe hoi|đường lớn|duong lon)/i);
  if (frontageMatch) {
    profile.frontage = frontageMatch[0];
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
      profile.business &&
      profile.budget
  );

const hasEnoughToAskPhone = (profile: PublicChatProfile) =>
  Boolean(
    profile.location &&
      profile.business &&
      profile.budget &&
      (profile.area || profile.structure)
  );

const nextQuestionFor = (profile: PublicChatProfile) => {
  if (!profile.business) {
    return "Mình đang cần thuê/mua để kinh doanh ngành gì hay để ở ạ?";
  }

  if (!profile.location) {
    return "Mình ưu tiên khu vực hoặc quận nào nhất để em lọc đúng vị trí ạ?";
  }

  if (!profile.budget) {
    return "Mình dự kiến ngân sách khoảng bao nhiêu, hoặc cần diện tích tầm bao nhiêu m2 ạ?";
  }

  if (!profile.phone) {
    return "Cho em xin số điện thoại để bạn phụ trách gọi tư vấn kỹ hơn và gửi căn phù hợp cho mình nhé?";
  }

  if (!profile.name) {
    return "Em tiện xưng hô với mình thế nào ạ?";
  }

  if (isGenericBusiness(profile.business)) {
    return "Dạ ok anh, em nắm mình tìm mặt bằng " +
      `${profile.location || ""} khoảng ${formatBudgetForReply(profile.budget) || profile.budget || ""}` +
      `${profile.structure ? `, ${profile.structure}` : ""}. Anh định kinh doanh ngành gì để em lọc mặt bằng sát hơn ạ?`;
  }

  if (!profile.structure) {
    return "Mình có cần kết cấu cụ thể như mấy phòng, mấy tầng hoặc trệt lửng không ạ?";
  }

  if (!profile.move_in_time) {
    return "Mình dự kiến cần nhận nhà hoặc bắt đầu thuê khi nào ạ?";
  }

  return "Em đã nắm khá đủ rồi ạ. Mình có yêu cầu đặc biệt nào cần em lưu ý thêm không?";
};

const fallbackReply = (message: string, profile: PublicChatProfile) => {
  const knownParts = [
    profile.business ? `nhu cầu ${profile.business}` : "",
    profile.location ? `khu vực ${profile.location}` : "",
    profile.budget ? `ngân sách ${profile.budget}` : "",
    profile.area ? `diện tích ${profile.area}` : "",
  ].filter(Boolean);
  const prefix = knownParts.length
    ? `Dạ em nắm ${knownParts.join(", ")} rồi ạ.`
    : "Dạ em chào mình, em hỗ trợ mình tìm nhà/mặt bằng phù hợp ạ.";

  if (isReadyToSave(profile)) {
    return `${prefix} Em đã lưu thông tin để bạn phụ trách tư vấn và gửi căn phù hợp cho mình sớm nhé.`;
  }

  return `${prefix} ${nextQuestionFor(profile)}`;
};

const summarizeKnownV2 = (profile: PublicChatProfile) => {
  const parts = [
    profile.business ? `${profile.business}` : "",
    profile.location ? `ở ${profile.location}` : "",
    profile.budget ? `khoảng ${profile.budget}/tháng` : "",
    profile.area ? `tầm ${profile.area}` : "",
    profile.structure ? `kết cấu ${profile.structure}` : "",
    profile.frontage ? `${profile.frontage}` : "",
    profile.move_in_time ? `nhận nhà ${profile.move_in_time}` : "",
  ].filter(Boolean);

  return parts.length ? `Dạ em thấy hiện mình đang tìm ${parts.join(", ")}.` : "";
};

const nextQuestionForV2 = (profile: PublicChatProfile) => {
  if (!profile.business) {
    return "Mình đang cần thuê/mua để kinh doanh ngành gì hay để ở ạ?";
  }

  if (!profile.location) {
    return "Mình ưu tiên khu vực nào nhất anh/chị nhỉ?";
  }

  if (!profile.budget) {
    return "Ngân sách mình muốn giữ khoảng bao nhiêu một tháng ạ?";
  }

  if (!profile.area) {
    return "Em hỏi thêm chút, mình cần khoảng bao nhiêu mét vuông anh/chị nhỉ?";
  }

  if (isGenericBusiness(profile.business)) {
    return "Dạ ok anh, em nắm mình tìm mặt bằng " +
      `${profile.location || ""} khoảng ${formatBudgetForReply(profile.budget) || profile.budget || ""}` +
      `${profile.structure ? `, ${profile.structure}` : ""}. Anh định kinh doanh ngành gì để em lọc mặt bằng sát hơn ạ?`;
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

  if (!profile.phone && hasEnoughToAskPhone(profile)) {
    return "Để em gửi những căn phù hợp nhất qua Zalo cho anh/chị, anh/chị cho em xin số điện thoại nhé.";
  }

  if (!profile.name) {
    return "Em tiện xưng hô với mình thế nào ạ?";
  }

  return "Anh/chị còn tiêu chí nào muốn em lưu ý thêm không ạ?";
};

const fallbackReplyV2 = (profile: PublicChatProfile) => {
  if (
    isGenericBusiness(profile.business) &&
    profile.location &&
    profile.budget &&
    profile.area
  ) {
    return nextQuestionForV2(profile);
  }

  const summary =
    summarizeKnownV2(profile) ||
    "Dạ em chào anh/chị, em hỗ trợ mình tìm nhà/mặt bằng phù hợp ạ.";

  return `${summary}\n\n${nextQuestionForV2(profile)}`;
};

const getConversationStage = (
  profile: PublicChatProfile,
  leadCreated: boolean,
  alreadyCreated: boolean
): ChatResult["conversation_stage"] => {
  if (leadCreated) return "lead_created";
  if (alreadyCreated) return "nurturing";
  if (isReadyToSave(profile)) return "qualification";
  return "discovery";
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
  nextQuestion: string
) => `
Bạn là một môi giới bất động sản thật đang nhắn với khách hàng ở Việt Nam.

Mục tiêu:
- Tư vấn tự nhiên như một người sale thân thiện, không giống chatbot điền form.
- Xưng hô anh/chị - em.
- Câu ngắn gọn, đời thường, chuyên nghiệp.
- Luôn tóm tắt những gì đã biết trước khi hỏi tiếp.
- Mỗi lần chỉ hỏi 1 thông tin còn thiếu quan trọng nhất.
- Không hỏi lại thông tin đã biết trong profile.
- Never ask for a field that is already known in known_requirements/profile.
- Không bịa thông tin. Chưa biết thì để null/missing.
- Nếu khách đổi nhu cầu, dùng thông tin mới nhất.
- Nếu khách nói ngắn như "Mặt tiền nha em", hiểu đó là frontage.
- Chỉ xin số điện thoại khi đã hiểu sâu nhu cầu: location + business + budget + (area hoặc structure).
- Khi đã tạo lead hoặc đủ lead, không kết thúc cuộc trò chuyện; tiếp tục khai thác area, structure, frontage, move_in_time.

Cấm dùng các câu:
- "Tôi đã ghi nhận"
- "Tôi đã hiểu"
- "Vui lòng cung cấp"
- "Xin cho biết"

Thứ tự hỏi thông tin còn thiếu:
business/use_case -> location -> budget -> area -> structure -> frontage -> move_in_time -> phone.

Profile đã biết:
${JSON.stringify(profile, null, 2)}

Câu hỏi tiếp theo nên tập trung vào đúng ý này, nếu vẫn còn thiếu:
${nextQuestion}

Lịch sử chat:
${JSON.stringify(history, null, 2)}

Tin nhắn mới nhất của khách:
${currentMessage}

Trả về JSON duy nhất:
{
  "reply": "Một câu trả lời tiếng Việt tự nhiên, có tóm tắt điều đã biết rồi hỏi đúng 1 câu tiếp theo nếu cần",
  "profile": {
    "name": string|null,
    "phone": string|null,
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

const createLead = async (req: Request, history: ChatMessage[], profile: PublicChatProfile) => {
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
    const baseProfile = extractProfile(textForExtraction, body.profile || {});
    const apiKey = process.env.OPENAI_API_KEY;
    let reply = fallbackReplyV2(baseProfile);
    let profile = baseProfile;
    let nextBestQuestion = nextQuestionForV2(baseProfile);

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: buildPromptV2(history, currentMessage, baseProfile, nextBestQuestion),
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
          `${textForExtraction}\n${Object.values(parsed.profile).filter(Boolean).join("\n")}`,
          parsed.profile
        );
        nextBestQuestion = nextQuestionForV2(profile);
        if (asksForKnownField(reply, profile)) {
          reply = fallbackReplyV2(profile);
        }
      }
    }

    const readyToSave = isReadyToSave(profile);
    let leadCreated = false;
    let lead: unknown;

    if (readyToSave && !body.lead_created) {
      lead = await createLead(
        req,
        [...history, { role: "user", content: currentMessage }, { role: "assistant", content: reply }],
        profile
      );
      leadCreated = true;
      reply = `${reply} Em đã lưu thông tin để đội ngũ tư vấn liên hệ và gửi căn phù hợp cho mình sớm ạ.`;
    }

    const result: ChatResult = {
      reply,
      profile,
      conversation_stage: getConversationStage(profile, leadCreated, Boolean(body.lead_created)),
      known_requirements: profile,
      missing_requirements: getMissingRequirements(profile),
      next_best_question: nextQuestionForV2(profile),
      suggested_reply: reply,
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
