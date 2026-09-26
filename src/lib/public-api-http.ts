import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { logError } from "@/lib/observability";
import {
  applyPublicApiRateLimitHeaders,
  authenticatePublicApiRequest,
  recordPublicApiRequest,
} from "@/lib/public-api";
import { applySecurityHeaders } from "@/lib/security";
import type { PublicApiScope } from "@/types/public-api";

export class PublicApiHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// Route templates, never raw URLs or request headers, are persisted in usage logs.
export async function handlePublicApiRequest(
  request: Request,
  route: string,
  scope: PublicApiScope,
  handler: () => Promise<Record<string, unknown>>
): Promise<NextResponse> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let auth: Awaited<ReturnType<typeof authenticatePublicApiRequest>> | undefined;
  let response: NextResponse;
  let errorCode: string | null = null;

  try {
    auth = await authenticatePublicApiRequest(request, scope);
    if (!auth.ok) {
      response = auth.response;
      errorCode = `http_${response.status}`;
    } else {
      response = NextResponse.json({ ...(await handler()), requestId });
    }
  } catch (error) {
    const known = error instanceof PublicApiHttpError;
    const status = known ? error.status : 503;
    errorCode = known ? `http_${status}` : "service_unavailable";
    response = NextResponse.json(
      { error: known ? error.message : "The API is temporarily unavailable. Please retry." },
      { status }
    );
    if (!known) {
      // Do not log database error text: it can contain credentials or request data.
      logError("Public API request failed", undefined, { route, requestId });
    }
  }

  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Cache-Control", "no-store");
  if (auth?.rateLimit) applyPublicApiRateLimitHeaders(response, auth.rateLimit);
  applySecurityHeaders(response);

  // Unknown keys have no workspace. Avoid an unbounded database write for random traffic.
  if (auth?.principal) {
    try {
      await recordPublicApiRequest({
        orgId: auth.principal.orgId,
        apiKeyId: auth.principal.keyId,
        route,
        method: request.method,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        requestId,
        errorMessage: errorCode,
      });
    } catch {
      logError("Public API usage log failed", undefined, { route, requestId });
    }
  }
  return response;
}
