import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_NAME } from "@/lib/serverAuth";
import { normalizeProfileRole } from "@/lib/roles";

export async function POST(req: Request) {
  const { accessToken } = await req.json();

  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Cannot load profile while creating server session.", {
      userId: authData.user.id,
      code: profileError.code,
      message: profileError.message,
    });
    return NextResponse.json(
      { success: false, error: "Không thể tải hồ sơ tài khoản." },
      { status: 500 }
    );
  }

  if (
    !profile ||
    typeof profile.role !== "string" ||
    !profile.role.trim() ||
    typeof profile.status !== "string" ||
    !profile.status.trim()
  ) {
    return NextResponse.json(
      { success: false, error: "Hồ sơ tài khoản thiếu role hoặc status." },
      { status: 422 }
    );
  }

  const role = normalizeProfileRole(profile?.role);

  if (role === "customer" || profile.status !== "approved") {
    return NextResponse.json(
      { success: false, role, status: profile.status },
      { status: 403 }
    );
  }

  (await cookies()).set(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  return NextResponse.json({ success: true, role, status: profile.status });
}

export async function DELETE() {
  (await cookies()).delete(AUTH_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
