import { NextResponse } from "next/server";

import {
  importNationwideIngestionBatch,
  IngestionBridgeValidationError,
  isAuthorizedIngestionBridgeRequest,
  parseNationwideIngestionBatch,
} from "@/lib/ingestion-bridge";
import { logError, logInfo } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedIngestionBridgeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const batch = parseNationwideIngestionBatch(await request.json());
    const result = await importNationwideIngestionBatch(batch);

    logInfo("Nationwide ingestion batch imported", result);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof IngestionBridgeValidationError) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid request body" },
        { status: 400 }
      );
    }

    logError("Nationwide ingestion batch failed", error);
    return NextResponse.json({ error: "Nationwide ingestion import failed" }, { status: 500 });
  }
}
