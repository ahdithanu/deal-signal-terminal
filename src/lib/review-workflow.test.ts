import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ReviewableOutput } from "@/types/workflow";

const TEST_DB_PATH = `${process.cwd()}/.data/test-review-workflow.db`;

const baseOutput: ReviewableOutput = {
  kind: "memo",
  title: "Harbor memo",
  body: "Original AI memo body.",
  summary: "Original AI summary.",
  generatedAt: "2026-07-04T00:00:00.000Z",
  mode: "rules",
};

describe("review workflow", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
  });

  afterEach(async () => {
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("supports valid review transitions and records history", async () => {
    const workflow = await import("@/lib/review-workflow");
    const submitted = await workflow.submitForReview({
      opportunityId: "opp-1",
      opportunitySlug: "harbor",
      actor: { userId: "user-1", orgId: "org-1" },
      originalOutput: baseOutput,
      comment: "Ready for review.",
    });
    const changes = await workflow.requestWorkflowChanges({
      opportunityId: "opp-1",
      opportunitySlug: "harbor",
      actor: { userId: "user-2", orgId: "org-1" },
      comment: "Clarify source limitations.",
    });

    expect(submitted.workflow.state).toBe("under_review");
    expect(changes.workflow.state).toBe("needs_human_review");
    expect(changes.events.map((event) => event.action)).toEqual([
      "submit_for_review",
      "request_changes",
    ]);
    expect(changes.decisions[0]?.decision).toBe("changes_requested");
    expect(changes.comments[0]?.body).toBe("Clarify source limitations.");
  });

  it("rejects invalid transitions", async () => {
    const workflow = await import("@/lib/review-workflow");
    await workflow.ensureReviewWorkflow({
      opportunityId: "opp-2",
      opportunitySlug: "harbor-2",
    });

    await expect(
      workflow.approveWorkflow({
        opportunityId: "opp-2",
        opportunitySlug: "harbor-2",
        actor: { userId: "user-1", orgId: "org-1" },
      })
    ).rejects.toThrow("Invalid workflow transition");
  });

  it("preserves original output while storing human edits", async () => {
    const workflow = await import("@/lib/review-workflow");
    await workflow.submitForReview({
      opportunityId: "opp-3",
      opportunitySlug: "harbor-3",
      actor: { userId: "user-1", orgId: "org-1" },
      originalOutput: baseOutput,
    });
    const edited = await workflow.editAiOutput({
      opportunityId: "opp-3",
      opportunitySlug: "harbor-3",
      actor: { userId: "user-1", orgId: "org-1" },
      originalOutput: baseOutput,
      editedOutput: {
        ...baseOutput,
        body: "Human edited memo body.",
      },
      editSummary: "Removed unsupported language.",
      feedbackLabels: [{ label: "unsupported_claim", value: "removed", targetType: "memo" }],
    });

    expect(edited.workflow.state).toBe("revised");
    expect(edited.workflow.originalOutput?.body).toBe("Original AI memo body.");
    expect(edited.editedOutputs[0]?.originalOutput.body).toBe("Original AI memo body.");
    expect(edited.editedOutputs[0]?.editedOutput.body).toBe("Human edited memo body.");
    expect(edited.feedbackLabels[0]?.label).toBe("unsupported_claim");
  });

  it("records approval history and feedback labels", async () => {
    const workflow = await import("@/lib/review-workflow");
    await workflow.submitForReview({
      opportunityId: "opp-4",
      opportunitySlug: "harbor-4",
      actor: { userId: "user-1", orgId: "org-1" },
      originalOutput: baseOutput,
    });
    const approved = await workflow.approveWorkflow({
      opportunityId: "opp-4",
      opportunitySlug: "harbor-4",
      actor: { userId: "reviewer-1", orgId: "org-1" },
      rationale: "Evidence is sufficient for export.",
      feedbackLabels: [{ label: "memo_quality", value: "approved", targetType: "memo" }],
    });

    expect(approved.workflow.state).toBe("approved");
    expect(approved.approvals).toHaveLength(1);
    expect(approved.approvals[0]?.approvedOutput.body).toBe(baseOutput.body);
    expect(approved.feedbackLabels[0]?.label).toBe("memo_quality");
    expect(approved.decisions[0]?.decision).toBe("approved");
  });
});
