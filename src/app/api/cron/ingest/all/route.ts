import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAllIngestions } from "@/lib/ingestion-runner";
import { logError, logInfo } from "@/lib/observability";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAllIngestions();

    logInfo("Scheduled market ingestion completed", {
      markets: result.markets.length,
      recordsFound: result.recordsFound,
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    logError("Scheduled market ingestion failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Scheduled ingestion failed",
      },
      { status: 500 }
    );
  }
}
