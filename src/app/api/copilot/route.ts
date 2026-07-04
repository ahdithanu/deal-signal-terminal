import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import { runCopilot } from "@/lib/copilot";
import type { CopilotRequest } from "@/types/copilot";

function parseRequest(value: unknown): CopilotRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.question !== "string") {
    return null;
  }

  return {
    question: record.question,
    intent: typeof record.intent === "string" ? (record.intent as CopilotRequest["intent"]) : undefined,
    opportunitySlug:
      typeof record.opportunitySlug === "string" ? record.opportunitySlug : undefined,
    compareSlugs: Array.isArray(record.compareSlugs)
      ? record.compareSlugs.filter((slug): slug is string => typeof slug === "string")
      : undefined,
    visibleOpportunitySlugs: Array.isArray(record.visibleOpportunitySlugs)
      ? record.visibleOpportunitySlugs.filter((slug): slug is string => typeof slug === "string")
      : undefined,
  };
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = parseRequest(await request.json());

  if (!payload) {
    return NextResponse.json({ error: "A Copilot question is required." }, { status: 400 });
  }

  const response = await runCopilot(payload, {
    orgId: session.orgId,
    userId: session.userId,
  });

  await recordAuditEvent({
    orgId: session.orgId,
    userId: session.userId,
    action: "copilot.ask",
    resourceType: "copilot",
    resourceId: response.id,
    metadata: {
      intent: response.intent,
      refused: response.refused,
      citationCount: response.citations.length,
    },
  });

  return NextResponse.json(response);
}
