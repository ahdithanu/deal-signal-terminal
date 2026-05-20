import { NextResponse } from "next/server";

import { loginWithDemoWorkspace } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { logError, logInfo, logWarn, redactEmail } from "@/lib/observability";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security";

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
    const rateLimit = checkRateLimit(request, {
      name: "auth-demo",
      max: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.ok) {
      const response = NextResponse.redirect(new URL("/login?error=rate-limited", request.url));
      response.headers.set("Retry-After", "60");
      return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit));
    }

    const session = await loginWithDemoWorkspace();

    if (!session) {
      logWarn("Demo workspace login unavailable");
      return applySecurityHeaders(
        applyRateLimitHeaders(
          NextResponse.redirect(new URL("/login?error=demo-unavailable", request.url)),
          rateLimit
        )
      );
    }

    logInfo("Demo workspace login succeeded", {
      userId: session.userId,
      orgId: session.orgId,
      email: redactEmail(session.email),
    });

    await recordAuditEvent({
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

    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit));
  } catch (error) {
    logError("Demo workspace route failed", error);
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/login?error=demo-unavailable", request.url))
    );
  }
}
