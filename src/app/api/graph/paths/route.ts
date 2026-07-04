import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { findRelationshipPaths } from "@/lib/knowledge-graph";
import { applySecurityHeaders } from "@/lib/security";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const maxDepth = Number(searchParams.get("maxDepth") ?? 3);

  if (!from || !to) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Both from and to entity ids are required." }, { status: 400 })
    );
  }

  return applySecurityHeaders(
    NextResponse.json({
      paths: await findRelationshipPaths(from, to, Number.isFinite(maxDepth) ? maxDepth : 3),
    })
  );
}
