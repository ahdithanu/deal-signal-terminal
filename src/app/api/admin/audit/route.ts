import { NextResponse } from "next/server";

import type { AuditEventRecord } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import { listRecentAuditEvents } from "@/lib/audit";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const events = (await listRecentAuditEvents({ orgId: session.orgId })).map((event: AuditEventRecord) => ({
    id: event.id,
    occurredAt: event.occurred_at,
    orgId: event.org_id,
    userId: event.user_id,
    action: event.action,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    metadata: JSON.parse(event.metadata_json),
  }));

  return NextResponse.json({ events });
}
