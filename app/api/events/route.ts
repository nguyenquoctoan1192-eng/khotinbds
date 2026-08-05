import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
 const access = await getAccess(req, ["admin", "agent"]);

if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const { customerId, eventType, metadata } = body;

  await supabase.from("customer_events").insert([
    {
      customer_id: customerId,
      event_type: eventType,
      metadata,
    },
  ]);

  return NextResponse.json({ success: true });
}
