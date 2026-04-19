import { NextResponse } from "next/server";

import { getAuthSession, userStateKeyForSession } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { logWarn } from "@/lib/observability";
import { getUserState, updateUserState } from "@/lib/user-state";
import type { WatchlistSnapshot } from "@/types/domain";

type WatchlistPayload = {
  opportunityId?: unknown;
  snapshot?: unknown;
};

function isWatchlistSnapshot(value: unknown): value is WatchlistSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<WatchlistSnapshot>;
  return (
    typeof snapshot.priorityScore === "number" &&
    (snapshot.confidenceLevel === "high" ||
      snapshot.confidenceLevel === "medium" ||
      snapshot.confidenceLevel === "low") &&
    (snapshot.developmentStage === "early_signal" ||
      snapshot.developmentStage === "pre_construction" ||
      snapshot.developmentStage === "active_construction" ||
      snapshot.developmentStage === "disruption") &&
    (snapshot.latestTimelineDate === null || typeof snapshot.latestTimelineDate === "string")
  );
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated watchlist write");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = (await request.json()) as WatchlistPayload;

  if (typeof payload.opportunityId !== "string" || payload.opportunityId.length === 0) {
    return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
  }

  if (payload.snapshot !== undefined && payload.snapshot !== null && !isWatchlistSnapshot(payload.snapshot)) {
    return NextResponse.json({ error: "Invalid watchlist snapshot." }, { status: 400 });
  }

  const state = await updateUserState(userStateKeyForSession(session), (current) => {
    const watchlist = { ...current.watchlist };

    watchlist[payload.opportunityId as string] = {
      savedAt: new Date().toISOString(),
      snapshot: payload.snapshot as WatchlistSnapshot | undefined,
    };

    return {
      ...current,
      watchlist,
    };
  });

  recordAuditEvent({
    orgId: session.orgId,
    userId: session.userId,
    action: "watchlist_add",
    resourceType: "opportunity",
    resourceId: payload.opportunityId as string,
    metadata: {
      hasSnapshot: Boolean(payload.snapshot),
    },
  });

  return NextResponse.json(state.watchlist);
}

export async function DELETE(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated watchlist delete");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const opportunityId = searchParams.get("opportunityId");

  if (!opportunityId) {
    return NextResponse.json({ error: "Missing opportunity id." }, { status: 400 });
  }

  const state = await updateUserState(userStateKeyForSession(session), (current) => {
    const watchlist = { ...current.watchlist };
    delete watchlist[opportunityId];

    return {
      ...current,
      watchlist,
    };
  });

  recordAuditEvent({
    orgId: session.orgId,
    userId: session.userId,
    action: "watchlist_remove",
    resourceType: "opportunity",
    resourceId: opportunityId,
  });

  return NextResponse.json(state.watchlist);
}

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated watchlist read");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const state = await getUserState(userStateKeyForSession(session));
  return NextResponse.json(state.watchlist);
}
