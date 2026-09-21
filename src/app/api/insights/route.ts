import { NextResponse } from "next/server";

import { answerOpportunitySetQuestion } from "@/lib/ai";
import { getAuthSession } from "@/lib/auth";
import { logWarn } from "@/lib/observability";
import { applyRateLimitHeaders, buildRateLimitResponse, checkRateLimit } from "@/lib/rate-limit";
import { applySecurityHeaders } from "@/lib/security";
import type { Opportunity } from "@/types/domain";

type InsightsPayload = {
  question?: unknown;
  opportunities?: unknown;
};

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    name: "insights",
    max: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return applySecurityHeaders(
      buildRateLimitResponse(rateLimit, "Too many insights requests. Please try again shortly.")
    );
  }

  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated insights request");
    return applySecurityHeaders(
      applyRateLimitHeaders(
        NextResponse.json({ error: "Authentication required." }, { status: 401 }),
        rateLimit
      )
    );
  }

  const payload = (await request.json()) as InsightsPayload;

  if (typeof payload.question !== "string" || payload.question.trim().length === 0) {
    return applySecurityHeaders(
      applyRateLimitHeaders(NextResponse.json({ error: "A question is required." }, { status: 400 }), rateLimit)
    );
  }

  if (!Array.isArray(payload.opportunities)) {
    return applySecurityHeaders(
      applyRateLimitHeaders(
        NextResponse.json({ error: "Visible opportunities are required." }, { status: 400 }),
        rateLimit
      )
    );
  }

  const visibleOpportunities = payload.opportunities as Opportunity[];
  const answer = await answerOpportunitySetQuestion(payload.question, visibleOpportunities);

  return applySecurityHeaders(
    applyRateLimitHeaders(NextResponse.json({ answer }), rateLimit)
  );
}
