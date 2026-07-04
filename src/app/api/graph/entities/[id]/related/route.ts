import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { getGraphEntityDetail, listRelatedEntities } from "@/lib/knowledge-graph";
import { applySecurityHeaders } from "@/lib/security";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  const { id } = await params;
  const entity = await getGraphEntityDetail(id);

  if (!entity) {
    return applySecurityHeaders(NextResponse.json({ error: "Entity not found." }, { status: 404 }));
  }

  return applySecurityHeaders(
    NextResponse.json({
      entity,
      related: await listRelatedEntities(id),
    })
  );
}
