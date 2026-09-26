import { getOpportunities } from "@/lib/opportunity-service";
import { handlePublicApiRequest } from "@/lib/public-api-http";
import { queryPublicOpportunities } from "@/lib/public-opportunities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handlePublicApiRequest(request, "/api/v1/opportunities", "opportunities:read", async () =>
    queryPublicOpportunities(await getOpportunities(), new URL(request.url).searchParams)
  );
}
