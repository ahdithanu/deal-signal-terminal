import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { dispatchPendingDomainEvents, getEventDashboard } from "@/lib/domain-events";

export async function GET() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await getEventDashboard();

  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));

  if (payload.action !== "dispatch_pending") {
    return NextResponse.json({ error: "Unsupported event action." }, { status: 400 });
  }

  const limit = typeof payload.limit === "number" && payload.limit > 0 ? payload.limit : 25;
  const result = await dispatchPendingDomainEvents(limit);

  return NextResponse.json({ result });
}
