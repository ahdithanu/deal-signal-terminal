import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import {
  DeploymentConfigValidationError,
  getWorkspaceDeploymentConfig,
  listWorkspaceDeploymentConfigHistory,
  updateWorkspaceDeploymentConfig,
} from "@/lib/deployment-config";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [config, history] = await Promise.all([
    getWorkspaceDeploymentConfig(session.orgId),
    listWorkspaceDeploymentConfigHistory(session.orgId),
  ]);

  return NextResponse.json({ config, history });
}

export async function PUT(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const result = await updateWorkspaceDeploymentConfig({
      orgId: session.orgId,
      userId: session.userId,
      input: payload,
    });
    const history = await listWorkspaceDeploymentConfigHistory(session.orgId);

    await recordAuditEvent({
      orgId: session.orgId,
      userId: session.userId,
      action: "deployment_settings.update",
      resourceType: "workspace_deployment_config",
      resourceId: session.orgId,
      metadata: {
        changedSections: result.changes.map((change) => change.section),
      },
    });

    return NextResponse.json({ config: result.config, history });
  } catch (error) {
    if (error instanceof DeploymentConfigValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
