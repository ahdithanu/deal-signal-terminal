import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { listDataHealthByMarket } from "@/lib/ingestion-store";

export async function GET() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const markets = await listDataHealthByMarket();

  return NextResponse.json({
    markets,
  });
}
