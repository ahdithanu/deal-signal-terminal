import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { getObservabilityDashboard, recordObservabilityIncident } from "@/lib/observability-dashboard";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const windowHours = Number(url.searchParams.get("windowHours") ?? "24");
  const dashboard = await getObservabilityDashboard({
    orgId: session.orgId,
    windowHours: Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 24,
  });

  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));

  if (payload.action !== "record_incident") {
    return NextResponse.json({ error: "Unsupported observability action." }, { status: 400 });
  }

  if (
    typeof payload.title !== "string" ||
    typeof payload.source !== "string" ||
    typeof payload.summary !== "string" ||
    !["info", "warning", "critical"].includes(payload.severity)
  ) {
    return NextResponse.json({ error: "Invalid incident payload." }, { status: 400 });
  }

  const incident = await recordObservabilityIncident({
    orgId: session.orgId,
    title: payload.title,
    source: payload.source,
    summary: payload.summary,
    severity: payload.severity,
    status: ["open", "investigating", "resolved"].includes(payload.status) ? payload.status : "open",
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  });

  return NextResponse.json({ incident }, { status: 201 });
}
