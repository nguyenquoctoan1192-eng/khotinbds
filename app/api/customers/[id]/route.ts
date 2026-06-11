import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    customer,
    conversations,
  });
}
