import { NextResponse } from "next/server";

import { getDatabaseInfo } from "@/lib/db";

export async function GET() {
  const database = getDatabaseInfo();

  return NextResponse.json({
    ok: true,
    service: "build-signals",
    timestamp: new Date().toISOString(),
    database: {
      provider: database.provider,
      postgresUrlConfigured: database.postgresUrlConfigured,
    },
  });
}
