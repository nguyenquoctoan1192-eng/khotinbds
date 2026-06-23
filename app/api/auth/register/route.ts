import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_AREAS } from "@/lib/agentProfile";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName = clean(body.full_name);
    const phone = clean(body.phone);
    const zalo = clean(body.zalo);
    const email = clean(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const area = clean(body.area);

    if (!fullName || !phone || !email || !password || !area) {
      return NextResponse.json(
        { success: false, error: "Vui lòng điền đầy đủ các trường bắt buộc." },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Email không hợp lệ." },
        { status: 400 }
      );
    }

    if (!/^[0-9+().\s-]{8,20}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Số điện thoại không hợp lệ." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." },
        { status: 400 }
      );
    }

    if (!AGENT_AREAS.includes(area as (typeof AGENT_AREAS)[number])) {
      return NextResponse.json(
        { success: false, error: "Khu vực phụ trách không hợp lệ." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, zalo: zalo || null, area },
      },
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message.includes("already")
            ? "Email này đã được đăng ký."
            : "Không thể tạo tài khoản. Vui lòng thử lại.",
        },
        { status: 400 }
      );
    }

    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json(
        { success: false, error: "Email này đã được đăng ký." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Đăng ký thành công. Tài khoản của bạn đang chờ Admin xét duyệt.",
    });
  } catch (error) {
    console.error("Agent registration failed:", error);
    return NextResponse.json(
      { success: false, error: "Không thể tạo tài khoản. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
