import { NextResponse } from "next/server";

import { loginWithPassword } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { logError, logInfo, logWarn, redactEmail } from "@/lib/observability";
import { applyRateLimitHeaders, buildRateLimitResponse, checkRateLimit } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request, {
      name: "auth-login",
      max: 10,
      windowMs: 60_000,
    });

    if (!rateLimit.ok) {
      return applySecurityHeaders(
        buildRateLimitResponse(rateLimit, "Too many login attempts. Please try again in a minute.")
      );
    }

    const payload = (await request.json()) as LoginPayload;

    if (typeof payload.email !== "string" || typeof payload.password !== "string") {
      return applySecurityHeaders(
        applyRateLimitHeaders(
          NextResponse.json({ error: "Invalid credentials." }, { status: 400 }),
          rateLimit
        )
      );
    }

    const session = await loginWithPassword(payload.email, payload.password);

    if (!session) {
      logWarn("Authentication failed", { email: redactEmail(payload.email) });
      return applySecurityHeaders(
        applyRateLimitHeaders(
          NextResponse.json({ error: "Email or password was incorrect." }, { status: 401 }),
          rateLimit
        )
      );
    }

    logInfo("Authentication succeeded", {
      userId: session.userId,
      orgId: session.orgId,
      email: redactEmail(session.email),
    });
    recordAuditEvent({
      orgId: session.orgId,
      userId: session.userId,
      action: "login",
      resourceType: "session",
      resourceId: session.token,
      metadata: {
        email: session.email,
      },
    });

    const response = NextResponse.json({
      ok: true,
      session: {
        userId: session.userId,
        orgId: session.orgId,
        orgName: session.orgName,
        orgSlug: session.orgSlug,
        email: session.email,
        name: session.name,
        role: session.role,
      },
    });

    response.cookies.set(AUTH_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return applySecurityHeaders(applyRateLimitHeaders(response, rateLimit));
  } catch (error) {
    logError("Authentication route failed", error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Login is temporarily unavailable. Check deployment env settings and server logs." },
        { status: 500 }
      )
    );
  }
}
