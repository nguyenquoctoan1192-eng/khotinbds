import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AGENT_AREAS } from "@/lib/agentProfile";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isExistingEmailError = (error: { code?: string; message?: string }) => {
  const code = error.code?.toLowerCase() || "";
  const message = error.message?.toLowerCase() || "";

  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("email exists")
  );
};

const isDatabaseProfileError = (error: { code?: string; message?: string }) => {
  const code = error.code?.toLowerCase() || "";
  const message = error.message?.toLowerCase() || "";

  return (
    code === "unexpected_failure" ||
    message.includes("database error") ||
    message.includes("profile")
  );
};

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Agent registration is missing Supabase server configuration.", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return NextResponse.json(
        { success: false, error: "Thiếu cấu hình Supabase trên server." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, zalo, area },
    });

    if (error || !data.user) {
      if (error) {
        console.error("Supabase Admin failed to create agent user.", {
          code: error.code,
          message: error.message,
          status: error.status,
        });
      }

      if (error && isExistingEmailError(error)) {
        return NextResponse.json(
          { success: false, error: "Email này đã được đăng ký." },
          { status: 409 }
        );
      }

      if (error && isDatabaseProfileError(error)) {
        return NextResponse.json(
          { success: false, error: "Không thể tạo hồ sơ môi giới." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Không thể tạo tài khoản. Vui lòng thử lại.",
        },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email,
        full_name: fullName,
        phone,
        zalo: zalo || null,
        area,
        role: "agent",
        status: "pending",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Failed to create agent profile after Auth User creation.", {
        userId: data.user.id,
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
      });

      const { error: cleanupError } = await supabase.auth.admin.deleteUser(
        data.user.id
      );
      if (cleanupError) {
        console.error("Failed to clean up Auth User after profile error.", {
          userId: data.user.id,
          code: cleanupError.code,
          message: cleanupError.message,
          status: cleanupError.status,
        });
      }

      return NextResponse.json(
        { success: false, error: "Không thể tạo hồ sơ môi giới." },
        { status: 500 }
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

