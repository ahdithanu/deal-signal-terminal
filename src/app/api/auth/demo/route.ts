import { NextResponse } from "next/server";

import { loginWithDemoWorkspace } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { logError, logInfo, logWarn } from "@/lib/observability";

function buildRedirect(request: Request): URL {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect");

  if (!redirectTo || !redirectTo.startsWith("/")) {
    return new URL("/?demo=1", request.url);
  }

  return new URL(redirectTo, request.url);
}

export async function GET(request: Request) {
  try {
    const session = await loginWithDemoWorkspace();

    if (!session) {
      logWarn("Demo workspace login unavailable");
      return NextResponse.redirect(new URL("/login?error=demo-unavailable", request.url));
    }

    logInfo("Demo workspace login succeeded", {
      userId: session.userId,
      orgId: session.orgId,
      email: session.email,
    });

    recordAuditEvent({
      orgId: session.orgId,
      userId: session.userId,
      action: "login",
      resourceType: "session",
      resourceId: session.token,
      metadata: {
        email: session.email,
        source: "demo-entry",
      },
    });

    const response = NextResponse.redirect(buildRedirect(request));
    response.cookies.set(AUTH_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (error) {
    logError("Demo workspace route failed", error);
    return NextResponse.redirect(new URL("/login?error=demo-unavailable", request.url));
  }
}
