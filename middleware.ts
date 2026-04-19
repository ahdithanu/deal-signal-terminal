import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";

const PUBLIC_PATHS = new Set(["/login"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth") || pathname === "/api/health";
}

function isProtectedApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/user-state") ||
    pathname.startsWith("/api/watchlist") ||
    pathname.startsWith("/api/notes") ||
    pathname.startsWith("/api/admin")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(AUTH_SESSION_COOKIE)?.value);

  if (!hasSessionCookie && isProtectedApi(pathname)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasSessionCookie && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
