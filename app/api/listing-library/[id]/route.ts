import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/services/supabaseServer";
import { getAccess } from "@/lib/access";

const supabase = createSupabaseServiceClient();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(req: Request, context: RouteContext) {
  const access = await getAccess(req, ["admin", "agent"]);

if (!access) {
  
    return NextResponse.json(
      { success: false, error: "Không có quyền xóa tin." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Thiếu ID tin đăng." },
      { status: 400 }
    );
  }

  const { data: existingItem, error: loadError } = await supabase
    .from("listing_library")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { success: false, error: loadError.message },
      { status: 500 }
    );
  }

  if (!existingItem) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy tin cần xóa." },
      { status: 404 }
    );
  }

 const isAdmin = access.isAdmin;
const isOwner = existingItem.user_id === access.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { success: false, error: "Bạn chỉ được xóa tin do chính bạn lưu." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("listing_library")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}