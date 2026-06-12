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
  move_in_time: string | null;
};

type ChatResult = {
  reply: string;
  profile: PublicChatProfile;
  missing_requirements: string[];
  ready_to_save: boolean;
  lead_created: boolean;
  lead?: unknown;
};

const profileKeys: Array<keyof PublicChatProfile> = [
  "name",
  "phone",
  "business",
  "location",
  "budget",
  "area",
  "structure",
  "move_in_time",
];

const profileLabels: Record<keyof PublicChatProfile, string> = {
  name: "name",
  phone: "phone",
  business: "business/use case",
  location: "location/district",
  budget: "budget",
  area: "area",
  structure: "structure",
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

const mergeProfiles = (...profiles: Partial<PublicChatProfile>[]): PublicChatProfile =>
  profiles.reduce<PublicChatProfile>((merged, profile) => {
    for (const key of profileKeys) {
      if (!merged[key] && profile[key]) {
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

  if (!profile.phone && phoneMatch) profile.phone = phoneMatch[0].replace(/\D/g, "");
  if (!profile.budget && budgetMatch) profile.budget = budgetMatch[0];
  if (!profile.area && areaMatch) profile.area = areaMatch[0];
  if (!profile.business && businessMatch) profile.business = businessMatch[0];
  if (!profile.structure && structureMatch) profile.structure = structureMatch[0];
  if (!profile.move_in_time && moveInMatch) profile.move_in_time = moveInMatch[0];
  if (!profile.location && locationMatch) profile.location = locationMatch[0];
  if (!profile.name && nameMatch?.[1]) profile.name = nameMatch[1].trim();

  if (!profile.business && /thue|thuê|mua|can|cần/.test(normalized)) {
    const businessSentence = text.match(/[^.?!]*(?:thuê|mua|cần|kinh doanh|mở)[^.?!]*/i);
    if (businessSentence) profile.business = businessSentence[0].trim();
  }

  return profile;
};

const getMissingRequirements = (profile: PublicChatProfile) =>
  profileKeys.filter((key) => !profile[key]).map((key) => profileLabels[key]);

const isReadyToSave = (profile: PublicChatProfile) =>
  Boolean(
    profile.phone &&
      profile.location &&
      profile.business &&
      (profile.budget || profile.area)
  );

const nextQuestionFor = (profile: PublicChatProfile) => {
  if (!profile.business) {
    return "Mình đang cần thuê/mua để kinh doanh ngành gì hay để ở ạ?";
  }

  if (!profile.location) {
    return "Mình ưu tiên khu vực hoặc quận nào nhất để em lọc đúng vị trí ạ?";
  }

  if (!profile.budget && !profile.area) {
    return "Mình dự kiến ngân sách khoảng bao nhiêu, hoặc cần diện tích tầm bao nhiêu m2 ạ?";
  }

  if (!profile.phone) {
    return "Cho em xin số điện thoại để bạn phụ trách gọi tư vấn kỹ hơn và gửi căn phù hợp cho mình nhé?";
  }

  if (!profile.name) {
    return "Em tiện xưng hô với mình thế nào ạ?";
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
    let reply = fallbackReply(currentMessage, baseProfile);
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
          input: buildPrompt(history, currentMessage, baseProfile),
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
      missing_requirements: getMissingRequirements(profile),
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
