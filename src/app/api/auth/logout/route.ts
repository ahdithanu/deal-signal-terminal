import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAuthSession } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { logInfo } from "@/lib/observability";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  recordAuditEvent({
    action: "logout",
    resourceType: "session",
    resourceId: token ?? null,
  });
  await clearAuthSession(token);
  logInfo("Authentication session cleared");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
