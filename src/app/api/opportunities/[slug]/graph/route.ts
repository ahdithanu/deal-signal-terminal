import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { buildOpportunityGraphContext } from "@/lib/opportunity-graph";
import { getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import { applySecurityHeaders } from "@/lib/security";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  const { slug } = await params;
  const opportunity = await getOpportunityBySlugWithGenerated(slug);

  if (!opportunity) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Opportunity not found." }, { status: 404 })
    );
  }

  return applySecurityHeaders(
    NextResponse.json({
      graph: await buildOpportunityGraphContext(opportunity),
    })
  );
}
