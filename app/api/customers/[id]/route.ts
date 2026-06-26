import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccess(req, ["admin", "agent"]);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (customerError) {
    return NextResponse.json(
      { error: customerError.message },
      { status: 500 }
    );
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: true });

  if (conversationsError) {
    return NextResponse.json(
      { error: conversationsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    customer,
    conversations,
  });
}