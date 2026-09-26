import { buildOpportunityGraphContext } from "@/lib/opportunity-graph";
import { getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import { handlePublicApiRequest, PublicApiHttpError } from "@/lib/public-api-http";
import { serializePublicGraph } from "@/lib/public-opportunities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handlePublicApiRequest(request, "/api/v1/opportunities/:slug/graph", "opportunities:graph:read", async () => {
    const { slug } = await params;
    const opportunity = await getOpportunityBySlugWithGenerated(slug);
    if (!opportunity) throw new PublicApiHttpError(404, "Opportunity not found.");
    return { data: serializePublicGraph(await buildOpportunityGraphContext(opportunity)) };
  });
}
