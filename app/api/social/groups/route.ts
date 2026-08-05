import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const district = new URL(request.url).searchParams.get("district");

  let query = getSocialAdminClient()
    .from("facebook_groups")
    .select("id,name,url,district,category,priority,is_active")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("name", { ascending: true });

  if (district?.trim()) {
    query = query.eq("district", district.trim());
  }

  const { data, error } = await query;

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ groups: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();

  const name = String(body?.name ?? "").trim();
  const url = String(body?.url ?? "").trim();

  if (!name || !url) {
    return NextResponse.json(
      { error: "Thiếu tên hoặc link nhóm" },
      { status: 400 },
    );
  }

  if (
    !/^https:\/\/(?:www\.)?facebook\.com\/groups\//i.test(url)
  ) {
    return NextResponse.json(
      { error: "Link nhóm Facebook không hợp lệ" },
      { status: 400 },
    );
  }

  const payload = {
    name,
    url,
    district: String(body?.district ?? "").trim() || null,
    category: String(body?.category ?? "general").trim(),
    priority: Math.max(1, Number(body?.priority) || 100),
    is_active: true,
  };

  const db = getSocialAdminClient();

  const { data: existing } = await db
    .from("facebook_groups")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await db
      .from("facebook_groups")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ group: data, restored: true });
  }

  const { data, error } = await db
    .from("facebook_groups")
    .insert(payload)
    .select()
    .single();

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ group: data });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => null);
  const id = String(url.searchParams.get("id") ?? body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { error: "Thiếu id nhóm" },
      { status: 400 },
    );
  }

  const { error } = await getSocialAdminClient()
    .from("facebook_groups")
    .update({ is_active: false })
    .eq("id", id);

  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ success: true, removedGroupId: id });
}
