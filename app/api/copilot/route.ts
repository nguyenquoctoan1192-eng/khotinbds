import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // save message
    await supabase.from("conversations").insert([
      {
        customer_id: customerId,
        channel: "chatbot",
        message,
        sender: "customer",
        created_at: new Date().toISOString(),
      },
    ]);

    // get listings
    const { data: listings } = await supabase
      .from("listings")
      .select("*")
      .limit(20);

    const q = message.toLowerCase();

    const scored = (listings || []).map((item) => {
      let score = 0;

      if (q.includes(item.district?.toLowerCase())) score += 30;
      if (q.includes("phÃ²ng") && item.bedrooms >= 1) score += 20;
      if (q.includes("tá»·") && item.price) score += 20;

      return { ...item, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const topListings = scored.slice(0, 5);

    const suggestReply =
      topListings.length > 0
        ? `MÃ¬nh tÃ¬m Ä‘Æ°á»£c ${topListings.length} cÄƒn phÃ¹ há»£p cho báº¡n.`
        : "Báº¡n cho mÃ¬nh thÃªm ngÃ¢n sÃ¡ch hoáº·c khu vá»±c nhÃ©.";

    // save AI reply (fake system)
    await supabase.from("conversations").insert([
      {
        customer_id: customerId,
        channel: "chatbot",
        message: suggestReply,
        sender: "ai",
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      topListings,
      suggestReply,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
