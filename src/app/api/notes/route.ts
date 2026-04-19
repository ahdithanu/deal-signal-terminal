import { NextResponse } from "next/server";

import { getAuthSession, userStateKeyForSession } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { logWarn } from "@/lib/observability";
import { getUserState, updateUserState } from "@/lib/user-state";

type NotesPayload = {
  opportunityId?: unknown;
  body?: unknown;
};

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated note read");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const opportunityId = searchParams.get("opportunityId");
  const state = await getUserState(userStateKeyForSession(session));

  if (!opportunityId) {
    return NextResponse.json(state.notes);
  }

  return NextResponse.json(state.notes[opportunityId] ?? null);
}

export async function PUT(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    logWarn("Rejected unauthenticated note write");
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = (await request.json()) as NotesPayload;

  if (typeof payload.opportunityId !== "string" || payload.opportunityId.length === 0) {
    return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
  }

  if (typeof payload.body !== "string") {
    return NextResponse.json({ error: "Invalid note body." }, { status: 400 });
  }

  const trimmedBody = payload.body.trim();

  const state = await updateUserState(userStateKeyForSession(session), (current) => {
    const notes = { ...current.notes };

    if (trimmedBody.length === 0) {
      delete notes[payload.opportunityId as string];
    } else {
      notes[payload.opportunityId as string] = {
        body: payload.body,
        savedAt: new Date().toISOString(),
      };
    }

    return {
      ...current,
      notes,
    };
  });

  recordAuditEvent({
    orgId: session.orgId,
    userId: session.userId,
    action: trimmedBody.length === 0 ? "note_delete" : "note_upsert",
    resourceType: "opportunity_note",
    resourceId: payload.opportunityId as string,
    metadata: {
      length: trimmedBody.length,
    },
  });

  return NextResponse.json(state.notes[payload.opportunityId as string] ?? null);
}
