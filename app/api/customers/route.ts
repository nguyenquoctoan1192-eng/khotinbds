import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/services/supabaseServer";
import { getAccess } from "@/lib/access";

const supabase = createSupabaseServiceClient();

export async function GET(req: Request) {
  const access = await getAccess(req, ["admin", "agent"]);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("customers").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}