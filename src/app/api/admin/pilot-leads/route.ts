import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { listPilotLeads } from "@/lib/pilot-leads";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const leads = await listPilotLeads();
  return NextResponse.json({ leads });
}
