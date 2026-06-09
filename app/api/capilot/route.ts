export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// normalize tiếng Việt
const normalize = (str: string = "") =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// parse JSON an toàn
function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, customerId } = body;

    if (!message || !customerId) {
      return NextResponse.json(
        { success: false, error: "Missing message or customerId" },
        { status: 400 }
      );
    }

    const cleanMessage = message.trim();

    // 1. SAVE CUSTOMER MESSAGE
    await supabase.from("conversations").insert([
      {
        customer_id: customerId,
        channel: "chatbot",
        message: cleanMessage,
        sender: "customer",
        created_at: new Date().toISOString(),
      },
    ]);

    // 2. GET CUSTOMER
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // 3. GET LISTINGS (LIMIT 30 cho nhẹ)
    const { data: listings } = await supabase
      .from("listings")
      .select("*")
      .limit(30);

    // 4. AI PROMPT (GIẢN LƯỢC để tránh lỗi GPT)
    const prompt = `
Bạn là AI môi giới bất động sản.

Khách nói:
${cleanMessage}

Danh sách nhà:
${JSON.stringify(listings)}

Hãy chọn 3-5 căn phù hợp nhất.

Trả về JSON DUY NHẤT:
{
  "topListings": [
    { "id": "", "title": "", "score": 0 }
  ],
  "suggestReply": "tin nhắn trả lời khách",
  "leadScore": 0
}
`;

    // 5. CALL OPENAI (STABLE MODEL)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const text = completion.choices[0]?.message?.content || "";

    let responseData = safeParse(text);

    // 6. FALLBACK nếu AI lỗi
    if (!responseData) {
      responseData = {
        topListings: [],
        suggestReply:
          "Mình chưa tìm được căn phù hợp, bạn cho mình thêm ngân sách hoặc khu vực nhé.",
        leadScore: 30,
      };
    }

    // 7. UPDATE CUSTOMER SCORE
    await supabase
      .from("customers")
      .update({
        lead_score: responseData.leadScore || 30,
        status: responseData.leadScore > 60 ? "hot" : "new",
      })
      .eq("id", customerId);

    // 8. SAVE AI MESSAGE
    await supabase.from("conversations").insert([
      {
        customer_id: customerId,
        channel: "chatbot",
        message: responseData.suggestReply,
        sender: "ai",
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      ...responseData,
    });
  } catch (err) {
    console.error("COPILOT ERROR:", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}