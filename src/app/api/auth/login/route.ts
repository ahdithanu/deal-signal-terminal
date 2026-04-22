import { NextResponse } from "next/server";

import { loginWithPassword } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-shared";
import { logError, logInfo, logWarn } from "@/lib/observability";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;

    if (typeof payload.email !== "string" || typeof payload.password !== "string") {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
    }

    const session = await loginWithPassword(payload.email, payload.password);

    if (!session) {
      logWarn("Authentication failed", { email: payload.email });
      return NextResponse.json({ error: "Email or password was incorrect." }, { status: 401 });
    }

    logInfo("Authentication succeeded", {
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

    return response;
  } catch (error) {
    logError("Authentication route failed", error);
    return NextResponse.json(
      { error: "Login is temporarily unavailable. Check deployment env settings and server logs." },
      { status: 500 }
    );
  }
}
