import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";
import { AGENT_AREAS, isProfileStatus } from "@/lib/agentProfile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const cleanSearch = (value: string) =>
  value.replace(/[%_]/g, (character) => `\\${character}`).replace(/[,()]/g, " ");

export async function GET(req: Request) {
  const access = await getAccess(req, ["admin"]);
if (!access) {
    return NextResponse.json({ success: false, error: "Không có quyền truy cập." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const area = searchParams.get("area")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const keyword = searchParams.get("keyword")?.trim() || "";

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, zalo, email, area, role, status, created_at, updated_at")
    .eq("role", "agent")
    .order("created_at", { ascending: false });

  if (area && AGENT_AREAS.includes(area as (typeof AGENT_AREAS)[number])) {
    query = query.eq("area", area);
  }
  if (status && isProfileStatus(status)) query = query.eq("status", status);
  if (keyword) {
    const search = `%${cleanSearch(keyword)}%`;
    query = query.or(`full_name.ilike.${search},phone.ilike.${search},zalo.ilike.${search},email.ilike.${search}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, agents: data || [] });
}

export async function PATCH(req: Request) {
  const access = await getAccess(req, ["admin"]);
if (!access) {
    return NextResponse.json({ success: false, error: "Không có quyền thực hiện." }, { status: 403 });
  }

  const body = await req.json();
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = body.status;

  if (!id || !isProfileStatus(status)) {
    return NextResponse.json({ success: false, error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id)
    .eq("role", "agent")
    .select("id, status, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Không tìm thấy môi giới." }, { status: 404 });
  }

  return NextResponse.json({ success: true, agent: data });
}
