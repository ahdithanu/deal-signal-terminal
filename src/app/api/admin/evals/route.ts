import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import {
  compareEvalRuns,
  createEvalDataset,
  listEvalDatasets,
  listEvalRuns,
  runEvalDataset,
} from "@/lib/ai-evals";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [datasets, runs] = await Promise.all([listEvalDatasets(), listEvalRuns()]);
  const url = new URL(request.url);
  const compareLeft = url.searchParams.get("compareLeft");
  const compareRight = url.searchParams.get("compareRight");
  const comparison =
    compareLeft && compareRight ? await compareEvalRuns(compareLeft, compareRight) : null;

  return NextResponse.json({ datasets, runs, comparison });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  if (payload.action === "create_dataset") {
    try {
      const dataset = await createEvalDataset(payload);
      await recordAuditEvent({
        orgId: session.orgId,
        userId: session.userId,
        action: "ai_eval.dataset.create",
        resourceType: "eval_dataset",
        resourceId: dataset.id,
        metadata: {
          workflow: dataset.workflow,
          cases: dataset.cases.length,
        },
      });
      return NextResponse.json({ dataset }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to create eval dataset." },
        { status: 400 }
      );
    }
  }

  const datasetId = typeof payload.datasetId === "string" ? payload.datasetId : undefined;
  const run = await runEvalDataset(datasetId);

  await recordAuditEvent({
    orgId: session.orgId,
    userId: session.userId,
    action: "ai_eval.run",
    resourceType: "eval_run",
    resourceId: run.id,
    metadata: {
      datasetId: run.datasetId,
      status: run.status,
      averageScore: run.averageScore,
      gatePassed: run.gatePassed,
      passedCases: run.passedCases,
      totalCases: run.totalCases,
    },
  });

  return NextResponse.json({ run });
}
