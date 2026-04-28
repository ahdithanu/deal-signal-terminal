import { NextResponse } from "next/server";

import { answerOpportunitySetQuestion } from "@/lib/ai";
import { getAuthSession } from "@/lib/auth";
import { logWarn } from "@/lib/observability";
import type { Opportunity } from "@/types/domain";

type InsightsPayload = {
  question?: unknown;
  opportunities?: unknown;
};

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated insights request");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = (await request.json()) as InsightsPayload;

  if (typeof payload.question !== "string" || payload.question.trim().length === 0) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  if (!Array.isArray(payload.opportunities)) {
    return NextResponse.json({ error: "Visible opportunities are required." }, { status: 400 });
  }

  const visibleOpportunities = payload.opportunities as Opportunity[];
  const answer = await answerOpportunitySetQuestion(payload.question, visibleOpportunities);

  return NextResponse.json({ answer });
}
