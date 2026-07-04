import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";
import { getOpportunityBySlugWithGenerated } from "@/lib/opportunity-service";
import {
  approveWorkflow,
  editAiOutput,
  exportWorkflow,
  getOrCreateWorkflowHistory,
  rejectWorkflow,
  requestWorkflowChanges,
  submitForReview,
} from "@/lib/review-workflow";
import { applySecurityHeaders } from "@/lib/security";
import type { FeedbackLabelRecord, ReviewableOutput, WorkflowAction } from "@/types/workflow";

type WorkflowPayload = {
  action?: unknown;
  comment?: unknown;
  rationale?: unknown;
  originalOutput?: unknown;
  editedOutput?: unknown;
  editSummary?: unknown;
  feedbackLabels?: unknown;
};

function isReviewableOutput(value: unknown): value is ReviewableOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReviewableOutput>;
  return (
    (candidate.kind === "memo" ||
      candidate.kind === "research" ||
      candidate.kind === "opportunity_summary") &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    (candidate.summary === undefined || typeof candidate.summary === "string") &&
    (candidate.generatedAt === undefined || typeof candidate.generatedAt === "string") &&
    (candidate.mode === undefined || typeof candidate.mode === "string")
  );
}

function sanitizeFeedbackLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const label = item as {
      label?: unknown;
      value?: unknown;
      targetType?: unknown;
      targetId?: unknown;
      metadata?: unknown;
    };

    if (typeof label.label !== "string" || typeof label.value !== "string") {
      return [];
    }

    const targetType: FeedbackLabelRecord["targetType"] =
      label.targetType === "recommendation" ||
      label.targetType === "agent_output" ||
      label.targetType === "opportunity"
        ? label.targetType
        : "memo";

    return [
      {
        label: label.label,
        value: label.value,
        targetType,
        targetId: typeof label.targetId === "string" ? label.targetId : null,
        metadata:
          label.metadata && typeof label.metadata === "object"
            ? (label.metadata as Record<string, unknown>)
            : {},
      },
    ];
  });
}

function actorFromSession(session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>) {
  return {
    userId: session.userId,
    orgId: session.orgId,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  const { slug } = await params;
  const opportunity = await getOpportunityBySlugWithGenerated(slug);

  if (!opportunity) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Opportunity not found." }, { status: 404 })
    );
  }

  return applySecurityHeaders(
    NextResponse.json({
      history: await getOrCreateWorkflowHistory({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
      }),
    })
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  const { slug } = await params;
  const opportunity = await getOpportunityBySlugWithGenerated(slug);

  if (!opportunity) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Opportunity not found." }, { status: 404 })
    );
  }

  const payload = (await request.json()) as WorkflowPayload;
  const action = payload.action as WorkflowAction;
  const comment = typeof payload.comment === "string" ? payload.comment : null;
  const rationale = typeof payload.rationale === "string" ? payload.rationale : comment;
  const originalOutput = isReviewableOutput(payload.originalOutput) ? payload.originalOutput : null;
  const editedOutput = isReviewableOutput(payload.editedOutput) ? payload.editedOutput : null;
  const feedbackLabels = sanitizeFeedbackLabels(payload.feedbackLabels);
  const actor = actorFromSession(session);

  try {
    let history;

    if (action === "submit_for_review") {
      history = await submitForReview({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        originalOutput,
        comment,
      });
    } else if (action === "approve") {
      history = await approveWorkflow({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        output: originalOutput,
        rationale,
        feedbackLabels,
      });
    } else if (action === "reject") {
      history = await rejectWorkflow({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        rationale,
        feedbackLabels,
      });
    } else if (action === "request_changes") {
      if (!comment?.trim()) {
        return applySecurityHeaders(
          NextResponse.json({ error: "A change request comment is required." }, { status: 400 })
        );
      }

      history = await requestWorkflowChanges({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        comment,
        feedbackLabels,
      });
    } else if (action === "edit_ai_output") {
      if (!originalOutput || !editedOutput) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "Original and edited outputs are required for edits." },
            { status: 400 }
          )
        );
      }

      history = await editAiOutput({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        originalOutput,
        editedOutput,
        editSummary: typeof payload.editSummary === "string" ? payload.editSummary : null,
        feedbackLabels,
      });
    } else if (action === "export") {
      history = await exportWorkflow({
        opportunityId: opportunity.id,
        opportunitySlug: opportunity.slug,
        actor,
        comment,
      });
    } else {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unsupported workflow action." }, { status: 400 })
      );
    }

    await recordAuditEvent({
      orgId: session.orgId,
      userId: session.userId,
      action: `workflow.${action}`,
      resourceType: "opportunity_workflow",
      resourceId: opportunity.id,
      metadata: {
        state: history.workflow.state,
        feedbackLabels: feedbackLabels.map((label) => `${label.label}:${label.value}`),
      },
    });

    return applySecurityHeaders(NextResponse.json({ history }));
  } catch (error) {
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Workflow action failed.",
        },
        { status: 400 }
      )
    );
  }
}
