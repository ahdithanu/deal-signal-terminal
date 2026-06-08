import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { runSanDiegoIngestion } from "@/lib/ingestion-runner";
import { logError } from "@/lib/observability";

export async function POST() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSanDiegoIngestion();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    logError("San Diego ingestion failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Ingestion failed",
      },
      { status: 500 }
    );
  }
}
