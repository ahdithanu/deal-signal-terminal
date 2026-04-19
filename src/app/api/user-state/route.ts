import { NextResponse } from "next/server";

import { getAuthSession, userStateKeyForSession } from "@/lib/auth";
import { logWarn } from "@/lib/observability";
import { getUserState } from "@/lib/user-state";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated user-state request");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const state = await getUserState(userStateKeyForSession(session));
  return NextResponse.json(state);
}
