import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { ingestElDoradoPermitSignals } from "@/lib/ingest-eldorado";
import { logError, logInfo } from "@/lib/observability";

export async function POST() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestElDoradoPermitSignals();

    logInfo("El Dorado ingestion completed", {
      runId: result.runId,
      marketId: result.marketId,
      recordsFound: result.recordsFound,
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    logError("El Dorado ingestion failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Ingestion failed",
      },
      { status: 500 }
    );
  }
}
