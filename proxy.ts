import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/authConstants";

export function proxy(request: NextRequest) {
  if (request.cookies.has(AUTH_COOKIE_NAME)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/listing-library/:path*",
    "/find/:path*",
    "/post/:path*",
    "/edit/:path*",
    "/assigned-homes/:path*",
    "/admin/:path*",
  ],
};
