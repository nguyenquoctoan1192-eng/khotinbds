import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RequirementProfile = {
  business: string | null;
  location: string | null;
  budget: string | null;
  area: string | null;
  structure: string | null;
  frontage: string | null;
  move_in_time: string | null;
};

type AssistantResult = {
  known_requirements: RequirementProfile;
  missing_requirements: string[];
  customer_intent: string;
  objection: string | null;
  suggested_replies: string[];
  next_best_question: string;
};

const profileKeys: Array<keyof RequirementProfile> = [
  "business",
  "location",
  "budget",
  "area",
  "structure",
  "frontage",
  "move_in_time",
];

const profileLabels: Record<keyof RequirementProfile, string> = {
  business: "Business",
  location: "Location",
  budget: "Budget",
  area: "Area",
  structure: "Structure",
  frontage: "Frontage",
  move_in_time: "Move-in time",
};

const emptyProfile = (): RequirementProfile => ({
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

const mergeProfiles = (...profiles: RequirementProfile[]) =>
  profiles.reduce((merged, profile) => {
    for (const key of profileKeys) {
      if (!merged[key] && profile[key]) {
        merged[key] = profile[key];
      }
    }

    return merged;
  }, emptyProfile());

const parseProfileFromStructuredText = (source: string) => {
  const profile = emptyProfile();
  const mappings: Array<[keyof RequirementProfile, RegExp]> = [
    ["business", /(?:business|business_use_case|use_case|nganh|ngành)\s*[=:]\s*([^|;\n]+)/i],
    ["location", /(?:location|khu_vuc|khu vực|quan|quận)\s*[=:]\s*([^|;\n]+)/i],
    ["budget", /(?:budget|ngan_sach|ngân sách|max_price)\s*[=:]\s*([^|;\n]+)/i],
    ["area", /(?:area|dien_tich|diện tích)\s*[=:]\s*([^|;\n]+)/i],
    ["structure", /(?:structure|ket_cau|kết cấu)\s*[=:]\s*([^|;\n]+)/i],
    ["frontage", /(?:frontage|mat_tien|mặt tiền|hem|hẻm|car_access)\s*[=:]\s*([^|;\n]+)/i],
    ["move_in_time", /(?:move_in_time|thoi_gian|thời gian|rental_time)\s*[=:]\s*([^|;\n]+)/i],
  ];

  for (const [key, pattern] of mappings) {
    const match = source.match(pattern);
    if (match?.[1]) {
      profile[key] = match[1].trim();
    }
  }

  return profile;
};

const inferProfileFromText = (source: string, lead: any = {}) => {
  const profile = parseProfileFromStructuredText(source);
  const normalized = normalizeText(source);
  const district = Array.isArray(lead?.preferred_districts)
    ? lead.preferred_districts.filter(Boolean).map(String).join(", ")
    : compactString(lead?.preferred_districts);

  if (!profile.location && district) {
    profile.location = district;
  }

  if (!profile.budget && lead?.max_price) {
    profile.budget = String(lead.max_price);
  }

  const budgetMatch = source.match(/(?:\d+(?:[.,]\d+)?\s*(?:tr|triệu|trieu|tỷ|ty|tỉ|ti)|\d{7,})/i);
  const areaMatch = source.match(/\d+\s*m(?:2|²)/i);
  const businessMatch = source.match(/\b(spa|cafe|cà phê|office|văn phòng|restaurant|nhà hàng|shop|showroom|kinh doanh|ở|để ở)\b/i);
  const structureMatch = source.match(/(?:\d+\s*(?:phòng|pn|wc|tầng|lầu)|trệt|lửng|sân thượng)/i);
  const frontageMatch = source.match(/(?:mặt tiền|hẻm|ô tô|oto|xe hơi|đường lớn|frontage|alley)/i);
  const moveInMatch = source.match(/(?:tháng này|tháng sau|tuần này|tuần sau|vào ở ngay|nhận nhà ngay|\d{1,2}\/\d{1,2})/i);

  if (!profile.budget && budgetMatch) profile.budget = budgetMatch[0];
  if (!profile.area && areaMatch) profile.area = areaMatch[0];
  if (!profile.business && businessMatch) profile.business = businessMatch[0];
  if (!profile.structure && structureMatch) profile.structure = structureMatch[0];
  if (!profile.frontage && frontageMatch) profile.frontage = frontageMatch[0];
  if (!profile.move_in_time && moveInMatch) profile.move_in_time = moveInMatch[0];

  const locationMatch = source.match(/(?:bình thạnh|phú nhuận|quận\s*\d+|q\.\s*\d+|thủ đức|gò vấp|tân bình|quận\s*[^\s,.;]+)/i);
  if (!profile.location && locationMatch) {
    profile.location = locationMatch[0];
  }

  if (!profile.frontage && /xe hoi|oto|o to|mat tien|hem/.test(normalized)) {
    profile.frontage = source.match(/[^.?!]*(?:xe hơi|ô tô|oto|mặt tiền|hẻm)[^.?!]*/i)?.[0]?.trim() || null;
  }

  return profile;
};

const getMissingRequirements = (profile: RequirementProfile) =>
  profileKeys.filter((key) => !profile[key]).map((key) => profileLabels[key]);

const detectObjection = (message: string) => {
  const normalized = normalizeText(message);

  if (/cao|mac|dat|qua gia|vuot ngan sach/.test(normalized)) return "price too high";
  if (/xa|khong dung khu|khong hop vi tri|vi tri chua/.test(normalized)) return "not suitable location";
  if (/suy nghi|xem lai|de toi|de em|chua quyet|can them thoi gian/.test(normalized)) return "needs time to think";
  if (/them can|them lua chon|option|can khac|gui them/.test(normalized)) return "wants more options";
  if (/so sanh|ben khac|moi gioi khac|can khac re hon/.test(normalized)) return "comparing with others";

  return null;
};

const getNextQuestion = (missing: string[]) => {
  const firstMissing = missing[0];

  if (firstMissing === "Business") return "Mình thuê/mua để kinh doanh ngành gì hay để ở ạ?";
  if (firstMissing === "Location") return "Mình ưu tiên khu vực nào nhất để em lọc đúng vị trí ạ?";
  if (firstMissing === "Budget") return "Ngân sách tối đa của mình khoảng bao nhiêu để em lọc sát hơn ạ?";
  if (firstMissing === "Area") return "Mình cần diện tích khoảng bao nhiêu m2 là đẹp ạ?";
  if (firstMissing === "Structure") return "Mình cần kết cấu khoảng mấy phòng hoặc mấy tầng ạ?";
  if (firstMissing === "Frontage") return "Mình có cần mặt tiền, hẻm xe hơi hay ô tô ra vào được không ạ?";
  if (firstMissing === "Move-in time") return "Mình dự kiến cần nhận nhà khi nào ạ?";

  return "Em đã nắm các ý chính rồi, mình muốn em ưu tiên tiêu chí nào nhất khi lọc nhà ạ?";
};

const fallbackResult = (message: string, profile: RequirementProfile): AssistantResult => {
  const missing = getMissingRequirements(profile);
  const objection = detectObjection(message);
  const knownParts = [
    profile.business ? `nhu cầu ${profile.business}` : "",
    profile.location ? `khu vực ${profile.location}` : "",
    profile.budget ? `ngân sách ${profile.budget}` : "",
  ].filter(Boolean);

  return {
    known_requirements: profile,
    missing_requirements: missing,
    customer_intent: objection ? "customer has an objection or needs reassurance" : "customer is sharing requirements",
    objection,
    suggested_replies: [
      `Dạ em nắm ${knownParts.join(", ") || "nhu cầu của mình"} rồi ạ. Em sẽ lọc kỹ các căn sát nhất, không gửi lan man để mình dễ xem.`,
      objection === "price too high"
        ? "Dạ nếu mức này hơi cao, em lọc lại nhóm giá mềm hơn nhưng vẫn giữ các tiêu chí chính cho mình ạ."
        : "Dạ được ạ, em sẽ ưu tiên những căn phù hợp nhất với thông tin mình đã chia sẻ trước.",
      `${getNextQuestion(missing)}`,
    ],
    next_best_question: getNextQuestion(missing),
  };
};

const buildPrompt = (
  message: string,
  history: unknown[],
  lead: unknown,
  mergedProfile: RequirementProfile,
  missing: string[]
) => `
You are an AI sales assistant for a Vietnamese real estate broker.

Rules:
- Build a customer requirement profile over time.
- Use only explicitly mentioned facts from lead data, CRM notes, activities, history, and the current message.
- Never invent missing customer information.
- Never ask again for fields already known in the provided merged profile.
- The next_best_question must focus only on one missing field from this list: ${missing.join(", ") || "none"}.
- Ask one thing at a time. Keep it friendly, conversational, and not form-like.
- Return Vietnamese replies that are natural, short, professional, and warm.

Tracked profile fields:
business, location, budget, area, structure, frontage, move_in_time.

Already merged known profile:
${JSON.stringify(mergedProfile, null, 2)}

Current customer message:
${message}

Existing lead data:
${JSON.stringify(lead || {}, null, 2)}

CRM activities/history:
${JSON.stringify(history || [], null, 2)}

Return JSON only with:
known_requirements, missing_requirements, customer_intent, objection, suggested_replies, next_best_question.
`;

const parseAssistantResult = (value: unknown, baseProfile: RequirementProfile): AssistantResult | null => {
  if (!value || typeof value !== "object") return null;

  const result = value as Partial<AssistantResult>;
  const suggestedReplies = Array.isArray(result.suggested_replies)
    ? result.suggested_replies.filter((reply): reply is string => typeof reply === "string").slice(0, 3)
    : [];

  if (suggestedReplies.length !== 3) return null;

  const profile = mergeProfiles(baseProfile, {
    ...emptyProfile(),
    ...(result.known_requirements || {}),
  });
  const missing = getMissingRequirements(profile);

  return {
    known_requirements: profile,
    missing_requirements: missing,
    customer_intent: typeof result.customer_intent === "string" ? result.customer_intent : "",
    objection: typeof result.objection === "string" ? result.objection : null,
    suggested_replies: suggestedReplies,
    next_best_question:
      typeof result.next_best_question === "string" && missing.length > 0
        ? result.next_best_question
        : getNextQuestion(missing),
  };
};

const buildProfileNote = (profile: RequirementProfile) =>
  profileKeys
    .filter((key) => profile[key])
    .map((key) => `${key}=${profile[key]}`)
    .join(" | ");

const mergeProfileIntoNote = (note: string | null, profile: RequirementProfile) => {
  const existingParts = (note || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.split("=")[0]?.trim();
      return !profileKeys.includes(key as keyof RequirementProfile);
    });
  const profileNote = buildProfileNote(profile);

  return [...existingParts, profileNote].filter(Boolean).join(" | ") || null;
};

const formatProfileActivity = (profile: RequirementProfile) =>
  profileKeys
    .filter((key) => profile[key])
    .map((key) => `${profileLabels[key]}: ${profile[key]}`)
    .join(" | ");

const saveProfile = async (lead: any, profile: RequirementProfile) => {
  const leadId = compactString(lead?.id);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!leadId || !supabaseUrl || !serviceRoleKey) {
    return { activity: null, updated_note: lead?.note || null };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const updatedNote = mergeProfileIntoNote(lead?.note || null, profile);

  await supabase
    .from("leads")
    .update({ note: updatedNote })
    .eq("id", leadId);

  const { data: activity } = await supabase
    .from("lead_activities")
    .insert([
      {
        lead_id: leadId,
        type: "AI hồ sơ nhu cầu",
        content: `Cập nhật hồ sơ nhu cầu: ${formatProfileActivity(profile)}`,
      },
    ])
    .select("id, lead_id, type, content, created_at")
    .single();

  return { activity, updated_note: updatedNote };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = compactString(body.message);

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Thiếu tin nhắn khách vừa gửi." },
        { status: 400 }
      );
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const historyText = history
      .map((item: any) => `${item.type || ""}: ${item.content || ""}`)
      .join("\n");
    const lead = body.lead || {};
    const baseProfile = mergeProfiles(
      inferProfileFromText(String(lead.note || ""), lead),
      inferProfileFromText(historyText, lead),
      inferProfileFromText(message, lead)
    );
    const baseMissing = getMissingRequirements(baseProfile);
    const apiKey = process.env.OPENAI_API_KEY;
    let assistant = fallbackResult(message, baseProfile);
    let source = "fallback";

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: buildPrompt(message, history, lead, baseProfile, baseMissing),
          text: {
            format: {
              type: "json_schema",
              name: "sales_assistant_profile_result",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  known_requirements: {
                    type: "object",
                    additionalProperties: false,
                    properties: Object.fromEntries(
                      profileKeys.map((key) => [key, { type: ["string", "null"] }])
                    ),
                    required: profileKeys,
                  },
                  missing_requirements: {
                    type: "array",
                    items: { type: "string" },
                  },
                  customer_intent: { type: "string" },
                  objection: {
                    type: ["string", "null"],
                    enum: [
                      "price too high",
                      "not suitable location",
                      "needs time to think",
                      "wants more options",
                      "comparing with others",
                      null,
                    ],
                  },
                  suggested_replies: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: { type: "string" },
                  },
                  next_best_question: { type: "string" },
                },
                required: [
                  "known_requirements",
                  "missing_requirements",
                  "customer_intent",
                  "objection",
                  "suggested_replies",
                  "next_best_question",
                ],
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
      const parsed = parseAssistantResult(JSON.parse(outputText), baseProfile);

      if (parsed) {
        assistant = parsed;
        source = "openai";
      }
    }

    const saved = await saveProfile(lead, assistant.known_requirements);

    return NextResponse.json({
      success: true,
      assistant,
      activity: saved.activity,
      updated_note: saved.updated_note,
      source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không tạo được gợi ý trả lời.",
      },
      { status: 500 }
    );
  }
}
