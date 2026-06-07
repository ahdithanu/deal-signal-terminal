import { NextResponse } from "next/server";

import { getAuthSession, updateWorkspaceIdentity } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { logError, logInfo } from "@/lib/observability";

const BUILD_SIGNALS_IDENTITY = {
  orgName: "Build Signals",
  orgSlug: "build-signals",
  adminEmail: "admin@buildsignals.local",
};

export async function POST() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await updateWorkspaceIdentity(session, BUILD_SIGNALS_IDENTITY);
    await recordAuditEvent({
      orgId: session.orgId,
      userId: session.userId,
      action: "workspace_identity_update",
      resourceType: "organization",
      resourceId: session.orgId,
      metadata: BUILD_SIGNALS_IDENTITY,
    });

    logInfo("Workspace identity updated", {
      orgId: session.orgId,
      userId: session.userId,
      orgSlug: BUILD_SIGNALS_IDENTITY.orgSlug,
    });

    return NextResponse.json({
      ok: true,
      identity: BUILD_SIGNALS_IDENTITY,
    });
  } catch (error) {
    logError("Workspace identity update failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Workspace identity update failed",
      },
      { status: 500 }
    );
  }
}
