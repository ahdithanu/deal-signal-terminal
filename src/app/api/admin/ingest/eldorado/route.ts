import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { runElDoradoIngestion } from "@/lib/ingestion-runner";
import { logError } from "@/lib/observability";

export async function POST() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runElDoradoIngestion();

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
