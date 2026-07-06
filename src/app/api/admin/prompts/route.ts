import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import {
  activatePromptVersion,
  createPromptVersion,
  listPromptRegistryEvents,
  listPromptTemplates,
} from "@/lib/prompt-registry";

export async function GET() {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await listPromptTemplates();
  const events = await listPromptRegistryEvents();

  return NextResponse.json({ templates, events });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));

  try {
    if (payload.action === "create_version") {
      const version = await createPromptVersion({
        promptKey: payload.promptKey,
        version: payload.version,
        promptBody: payload.promptBody,
        variables: Array.isArray(payload.variables) ? payload.variables : [],
        outputSchema:
          payload.outputSchema && typeof payload.outputSchema === "object" ? payload.outputSchema : {},
        modelFamily: payload.modelFamily ?? "structured-chat",
        changelog: payload.changelog ?? "",
        createdByUserId: session.userId,
      });

      await recordAuditEvent({
        orgId: session.orgId,
        userId: session.userId,
        action: "prompt_registry.version.create",
        resourceType: "prompt_version",
        resourceId: version.id,
        metadata: { promptKey: payload.promptKey, version: version.version },
      });

      return NextResponse.json({ version }, { status: 201 });
    }

    if (payload.action === "activate_version") {
      const template = await activatePromptVersion({
        promptKey: payload.promptKey,
        versionId: payload.versionId,
        userId: session.userId,
      });

      await recordAuditEvent({
        orgId: session.orgId,
        userId: session.userId,
        action: "prompt_registry.version.activate",
        resourceType: "prompt_template",
        resourceId: template?.id ?? payload.promptKey,
        metadata: { promptKey: payload.promptKey, versionId: payload.versionId },
      });

      return NextResponse.json({ template });
    }

    return NextResponse.json({ error: "Unsupported prompt registry action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prompt registry action failed." },
      { status: 400 }
    );
  }
}
