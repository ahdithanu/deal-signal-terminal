import { randomUUID } from "node:crypto";

import { getDatabase, resolveDatabaseProvider } from "@/lib/db";
import { emitDomainEvent } from "@/lib/domain-events";
import { queryPostgres } from "@/lib/postgres";
import type {
  ApprovalHistoryRecord,
  EditedOutputRecord,
  FeedbackLabelRecord,
  ReviewDecision,
  ReviewWorkflow,
  ReviewableOutput,
  ReviewerCommentRecord,
  WorkflowAction,
  WorkflowEventRecord,
  WorkflowHistory,
  WorkflowState,
} from "@/types/workflow";

type Actor = {
  userId?: string | null;
  orgId?: string | null;
};

type WorkflowRow = {
  id: string;
  opportunity_id: string;
  opportunity_slug: string;
  state: WorkflowState;
  original_output_json: string | null;
  current_edited_output_id: string | null;
  created_at: string;
  updated_at: string;
  last_transition_at: string;
};

type EventRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  actor_user_id: string | null;
  actor_org_id: string | null;
  action: WorkflowAction;
  from_state: WorkflowState | null;
  to_state: WorkflowState;
  comment: string | null;
  metadata_json: string;
  created_at: string;
};

type DecisionRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  reviewer_user_id: string | null;
  decision: ReviewDecision;
  from_state: WorkflowState;
  to_state: WorkflowState;
  rationale: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  reviewer_user_id: string | null;
  body: string;
  comment_type: ReviewerCommentRecord["commentType"];
  created_at: string;
};

type EditedOutputRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  editor_user_id: string | null;
  original_output_json: string;
  edited_output_json: string;
  edit_summary: string | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  approver_user_id: string | null;
  approved_output_json: string;
  approved_state: WorkflowState;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  workflow_id: string;
  opportunity_id: string;
  reviewer_user_id: string | null;
  label: string;
  value: string;
  target_type: FeedbackLabelRecord["targetType"];
  target_id: string | null;
  metadata_json: string;
  created_at: string;
};

const VALID_TRANSITIONS: Record<WorkflowAction, Partial<Record<WorkflowState, WorkflowState>>> = {
  submit_for_review: {
    new: "under_review",
    ai_memo_drafted: "under_review",
    revised: "under_review",
    rejected: "under_review",
    needs_human_review: "under_review",
  },
  approve: {
    under_review: "approved",
    ai_memo_drafted: "approved",
    needs_human_review: "approved",
    revised: "approved",
  },
  reject: {
    under_review: "rejected",
    ai_memo_drafted: "rejected",
    needs_human_review: "rejected",
    revised: "rejected",
  },
  request_changes: {
    under_review: "needs_human_review",
    ai_memo_drafted: "needs_human_review",
    revised: "needs_human_review",
  },
  edit_ai_output: {
    under_review: "revised",
    ai_memo_drafted: "revised",
    needs_human_review: "revised",
    rejected: "revised",
    revised: "revised",
  },
  export: {
    approved: "exported",
  },
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function workflowFromRow(row: WorkflowRow): ReviewWorkflow {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunitySlug: row.opportunity_slug,
    state: row.state,
    originalOutput: parseJson<ReviewableOutput | null>(row.original_output_json, null),
    currentEditedOutputId: row.current_edited_output_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastTransitionAt: row.last_transition_at,
  };
}

function eventFromRow(row: EventRow): WorkflowEventRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    actorUserId: row.actor_user_id,
    actorOrgId: row.actor_org_id,
    action: row.action,
    fromState: row.from_state,
    toState: row.to_state,
    comment: row.comment,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

function editedOutputFromRow(row: EditedOutputRow): EditedOutputRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    editorUserId: row.editor_user_id,
    originalOutput: parseJson(row.original_output_json, {
      kind: "memo",
      title: "Unknown original",
      body: "",
    }),
    editedOutput: parseJson(row.edited_output_json, {
      kind: "memo",
      title: "Unknown edit",
      body: "",
    }),
    editSummary: row.edit_summary,
    createdAt: row.created_at,
  };
}

function currentOutput(history: WorkflowHistory): ReviewableOutput | null {
  const latestEdit = history.editedOutputs[history.editedOutputs.length - 1];
  return latestEdit?.editedOutput ?? history.workflow.originalOutput;
}

async function getWorkflowByOpportunityId(opportunityId: string): Promise<ReviewWorkflow | null> {
  if (resolveDatabaseProvider() === "postgres") {
    const result = await queryPostgres<WorkflowRow>(
      "SELECT * FROM review_workflows WHERE opportunity_id = $1",
      [opportunityId]
    );
    return result.rows[0] ? workflowFromRow(result.rows[0]) : null;
  }

  const row = getDatabase()
    .prepare("SELECT * FROM review_workflows WHERE opportunity_id = ?")
    .get(opportunityId) as WorkflowRow | undefined;
  return row ? workflowFromRow(row) : null;
}

export async function ensureReviewWorkflow(input: {
  opportunityId: string;
  opportunitySlug: string;
  originalOutput?: ReviewableOutput | null;
}): Promise<ReviewWorkflow> {
  const existing = await getWorkflowByOpportunityId(input.opportunityId);
  const now = new Date().toISOString();

  if (existing) {
    if (!existing.originalOutput && input.originalOutput) {
      const originalJson = JSON.stringify(input.originalOutput);

      if (resolveDatabaseProvider() === "postgres") {
        await queryPostgres(
          `UPDATE review_workflows
          SET original_output_json = $1, state = CASE WHEN state = 'new' THEN 'ai_memo_drafted' ELSE state END,
            updated_at = $2
          WHERE id = $3`,
          [originalJson, now, existing.id]
        );
      } else {
        getDatabase()
          .prepare(
            `UPDATE review_workflows
            SET original_output_json = ?, state = CASE WHEN state = 'new' THEN 'ai_memo_drafted' ELSE state END,
              updated_at = ?
            WHERE id = ?`
          )
          .run(originalJson, now, existing.id);
      }
    }

    return (await getWorkflowByOpportunityId(input.opportunityId)) as ReviewWorkflow;
  }

  const id = randomUUID();
  const state: WorkflowState = input.originalOutput ? "ai_memo_drafted" : "new";
  const values = [
    id,
    input.opportunityId,
    input.opportunitySlug,
    state,
    input.originalOutput ? JSON.stringify(input.originalOutput) : null,
    null,
    now,
    now,
    now,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO review_workflows (
        id, opportunity_id, opportunity_slug, state, original_output_json,
        current_edited_output_id, created_at, updated_at, last_transition_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO review_workflows (
          id, opportunity_id, opportunity_slug, state, original_output_json,
          current_edited_output_id, created_at, updated_at, last_transition_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  return (await getWorkflowByOpportunityId(input.opportunityId)) as ReviewWorkflow;
}

async function addWorkflowEvent(input: {
  workflow: ReviewWorkflow;
  actor: Actor;
  action: WorkflowAction;
  fromState: WorkflowState | null;
  toState: WorkflowState;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const values = [
    randomUUID(),
    input.workflow.id,
    input.workflow.opportunityId,
    input.actor.userId ?? null,
    input.actor.orgId ?? null,
    input.action,
    input.fromState,
    input.toState,
    input.comment ?? null,
    JSON.stringify(input.metadata ?? {}),
    new Date().toISOString(),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO workflow_events (
        id, workflow_id, opportunity_id, actor_user_id, actor_org_id, action,
        from_state, to_state, comment, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values
    );
    return;
  }

  getDatabase()
    .prepare(
      `INSERT INTO workflow_events (
        id, workflow_id, opportunity_id, actor_user_id, actor_org_id, action,
        from_state, to_state, comment, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

async function setWorkflowState(
  workflow: ReviewWorkflow,
  nextState: WorkflowState,
  currentEditedOutputId?: string | null
) {
  const now = new Date().toISOString();

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `UPDATE review_workflows
      SET state = $1, current_edited_output_id = COALESCE($2, current_edited_output_id),
        updated_at = $3, last_transition_at = $3
      WHERE id = $4`,
      [nextState, currentEditedOutputId ?? null, now, workflow.id]
    );
    return;
  }

  getDatabase()
    .prepare(
      `UPDATE review_workflows
      SET state = ?, current_edited_output_id = COALESCE(?, current_edited_output_id),
        updated_at = ?, last_transition_at = ?
      WHERE id = ?`
    )
    .run(nextState, currentEditedOutputId ?? null, now, now, workflow.id);
}

async function transition(input: {
  workflow: ReviewWorkflow;
  actor: Actor;
  action: WorkflowAction;
  comment?: string | null;
  metadata?: Record<string, unknown>;
  editedOutputId?: string | null;
}) {
  const nextState = VALID_TRANSITIONS[input.action][input.workflow.state];

  if (!nextState) {
    throw new Error(`Invalid workflow transition: ${input.action} from ${input.workflow.state}.`);
  }

  await setWorkflowState(input.workflow, nextState, input.editedOutputId);
  await addWorkflowEvent({
    workflow: input.workflow,
    actor: input.actor,
    action: input.action,
    fromState: input.workflow.state,
    toState: nextState,
    comment: input.comment,
    metadata: input.metadata,
  });
  await emitDomainEvent({
    eventType: "review.workflow.transitioned",
    aggregateType: "review_workflow",
    aggregateId: input.workflow.id,
    orgId: input.actor.orgId,
    userId: input.actor.userId,
    payload: {
      opportunityId: input.workflow.opportunityId,
      opportunitySlug: input.workflow.opportunitySlug,
      action: input.action,
      fromState: input.workflow.state,
      toState: nextState,
      editedOutputId: input.editedOutputId ?? null,
    },
  });

  return getWorkflowHistory(input.workflow.opportunityId);
}

async function addDecision(input: {
  workflow: ReviewWorkflow;
  actor: Actor;
  decision: ReviewDecision;
  fromState: WorkflowState;
  toState: WorkflowState;
  rationale?: string | null;
}) {
  const values = [
    randomUUID(),
    input.workflow.id,
    input.workflow.opportunityId,
    input.actor.userId ?? null,
    input.decision,
    input.fromState,
    input.toState,
    input.rationale ?? null,
    new Date().toISOString(),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO review_decisions (
        id, workflow_id, opportunity_id, reviewer_user_id, decision,
        from_state, to_state, rationale, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO review_decisions (
          id, workflow_id, opportunity_id, reviewer_user_id, decision,
          from_state, to_state, rationale, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }
}

async function addComment(input: {
  workflow: ReviewWorkflow;
  actor: Actor;
  body: string;
  commentType: ReviewerCommentRecord["commentType"];
}) {
  if (!input.body.trim()) return;

  const values = [
    randomUUID(),
    input.workflow.id,
    input.workflow.opportunityId,
    input.actor.userId ?? null,
    input.body.trim(),
    input.commentType,
    new Date().toISOString(),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO reviewer_comments (
        id, workflow_id, opportunity_id, reviewer_user_id, body, comment_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO reviewer_comments (
          id, workflow_id, opportunity_id, reviewer_user_id, body, comment_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }
}

async function addFeedbackLabels(input: {
  workflow: ReviewWorkflow;
  actor: Actor;
  labels?: Array<{ label: string; value: string; targetType?: FeedbackLabelRecord["targetType"]; targetId?: string | null; metadata?: Record<string, unknown> }>;
}) {
  for (const label of input.labels ?? []) {
    if (!label.label.trim() || !label.value.trim()) continue;

    const values = [
      randomUUID(),
      input.workflow.id,
      input.workflow.opportunityId,
      input.actor.userId ?? null,
      label.label.trim(),
      label.value.trim(),
      label.targetType ?? "memo",
      label.targetId ?? null,
      JSON.stringify(label.metadata ?? {}),
      new Date().toISOString(),
    ];

    if (resolveDatabaseProvider() === "postgres") {
      await queryPostgres(
        `INSERT INTO feedback_labels (
          id, workflow_id, opportunity_id, reviewer_user_id, label, value,
          target_type, target_id, metadata_json, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        values
      );
    } else {
      getDatabase()
        .prepare(
          `INSERT INTO feedback_labels (
            id, workflow_id, opportunity_id, reviewer_user_id, label, value,
            target_type, target_id, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...values);
    }
  }
}

export async function submitForReview(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  originalOutput?: ReviewableOutput | null;
  comment?: string | null;
}) {
  const workflow = await ensureReviewWorkflow(input);
  return transition({
    workflow,
    actor: input.actor,
    action: "submit_for_review",
    comment: input.comment,
    metadata: { hasOriginalOutput: Boolean(input.originalOutput ?? workflow.originalOutput) },
  });
}

export async function approveWorkflow(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  output?: ReviewableOutput | null;
  rationale?: string | null;
  feedbackLabels?: Parameters<typeof addFeedbackLabels>[0]["labels"];
}) {
  const workflow = await ensureReviewWorkflow(input);
  const nextState = VALID_TRANSITIONS.approve[workflow.state];

  if (!nextState) {
    throw new Error(`Invalid workflow transition: approve from ${workflow.state}.`);
  }

  const history = await getWorkflowHistory(workflow.opportunityId);
  const approvedOutput = input.output ?? currentOutput(history);

  if (!approvedOutput) {
    throw new Error("Cannot approve without an AI output or edited output.");
  }

  await addDecision({
    workflow,
    actor: input.actor,
    decision: "approved",
    fromState: workflow.state,
    toState: nextState,
    rationale: input.rationale,
  });
  await addApproval(workflow, input.actor, approvedOutput, nextState);
  await addComment({
    workflow,
    actor: input.actor,
    body: input.rationale ?? "",
    commentType: "approval",
  });
  await addFeedbackLabels({ workflow, actor: input.actor, labels: input.feedbackLabels });
  return transition({
    workflow,
    actor: input.actor,
    action: "approve",
    comment: input.rationale,
  });
}

async function addApproval(
  workflow: ReviewWorkflow,
  actor: Actor,
  approvedOutput: ReviewableOutput,
  approvedState: WorkflowState
) {
  const values = [
    randomUUID(),
    workflow.id,
    workflow.opportunityId,
    actor.userId ?? null,
    JSON.stringify(approvedOutput),
    approvedState,
    new Date().toISOString(),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO approval_history (
        id, workflow_id, opportunity_id, approver_user_id, approved_output_json,
        approved_state, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO approval_history (
          id, workflow_id, opportunity_id, approver_user_id, approved_output_json,
          approved_state, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }
}

export async function rejectWorkflow(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  rationale?: string | null;
  feedbackLabels?: Parameters<typeof addFeedbackLabels>[0]["labels"];
}) {
  const workflow = await ensureReviewWorkflow(input);
  const nextState = VALID_TRANSITIONS.reject[workflow.state];

  if (!nextState) {
    throw new Error(`Invalid workflow transition: reject from ${workflow.state}.`);
  }

  await addDecision({
    workflow,
    actor: input.actor,
    decision: "rejected",
    fromState: workflow.state,
    toState: nextState,
    rationale: input.rationale,
  });
  await addComment({
    workflow,
    actor: input.actor,
    body: input.rationale ?? "",
    commentType: "rejection",
  });
  await addFeedbackLabels({ workflow, actor: input.actor, labels: input.feedbackLabels });
  return transition({
    workflow,
    actor: input.actor,
    action: "reject",
    comment: input.rationale,
  });
}

export async function requestWorkflowChanges(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  comment: string;
  feedbackLabels?: Parameters<typeof addFeedbackLabels>[0]["labels"];
}) {
  const workflow = await ensureReviewWorkflow(input);
  const nextState = VALID_TRANSITIONS.request_changes[workflow.state];

  if (!nextState) {
    throw new Error(`Invalid workflow transition: request_changes from ${workflow.state}.`);
  }

  await addDecision({
    workflow,
    actor: input.actor,
    decision: "changes_requested",
    fromState: workflow.state,
    toState: nextState,
    rationale: input.comment,
  });
  await addComment({
    workflow,
    actor: input.actor,
    body: input.comment,
    commentType: "change_request",
  });
  await addFeedbackLabels({ workflow, actor: input.actor, labels: input.feedbackLabels });
  return transition({
    workflow,
    actor: input.actor,
    action: "request_changes",
    comment: input.comment,
  });
}

export async function editAiOutput(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  originalOutput: ReviewableOutput;
  editedOutput: ReviewableOutput;
  editSummary?: string | null;
  feedbackLabels?: Parameters<typeof addFeedbackLabels>[0]["labels"];
}) {
  const workflow = await ensureReviewWorkflow(input);
  const nextState = VALID_TRANSITIONS.edit_ai_output[workflow.state];

  if (!nextState) {
    throw new Error(`Invalid workflow transition: edit_ai_output from ${workflow.state}.`);
  }

  const editId = randomUUID();
  const values = [
    editId,
    workflow.id,
    workflow.opportunityId,
    input.actor.userId ?? null,
    JSON.stringify(workflow.originalOutput ?? input.originalOutput),
    JSON.stringify(input.editedOutput),
    input.editSummary ?? null,
    new Date().toISOString(),
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO edited_outputs (
        id, workflow_id, opportunity_id, editor_user_id, original_output_json,
        edited_output_json, edit_summary, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO edited_outputs (
          id, workflow_id, opportunity_id, editor_user_id, original_output_json,
          edited_output_json, edit_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  await addComment({
    workflow,
    actor: input.actor,
    body: input.editSummary ?? "",
    commentType: "edit",
  });
  await addFeedbackLabels({ workflow, actor: input.actor, labels: input.feedbackLabels });
  return transition({
    workflow,
    actor: input.actor,
    action: "edit_ai_output",
    comment: input.editSummary,
    editedOutputId: editId,
  });
}

export async function exportWorkflow(input: {
  opportunityId: string;
  opportunitySlug: string;
  actor: Actor;
  comment?: string | null;
}) {
  const workflow = await ensureReviewWorkflow(input);
  return transition({
    workflow,
    actor: input.actor,
    action: "export",
    comment: input.comment,
  });
}

async function listRows<T>(sql: string, postgresSql: string, workflowId: string): Promise<T[]> {
  if (resolveDatabaseProvider() === "postgres") {
    return (await queryPostgres<T & { id: string }>(postgresSql, [workflowId])).rows as T[];
  }

  return getDatabase().prepare(sql).all(workflowId) as T[];
}

export async function getWorkflowHistory(opportunityId: string): Promise<WorkflowHistory> {
  const workflow = await getWorkflowByOpportunityId(opportunityId);

  if (!workflow) {
    throw new Error(`Workflow not found for opportunity ${opportunityId}.`);
  }

  const events = (
    await listRows<EventRow>(
      "SELECT * FROM workflow_events WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM workflow_events WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map(eventFromRow);
  const decisions = (
    await listRows<DecisionRow>(
      "SELECT * FROM review_decisions WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM review_decisions WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    reviewerUserId: row.reviewer_user_id,
    decision: row.decision,
    fromState: row.from_state,
    toState: row.to_state,
    rationale: row.rationale,
    createdAt: row.created_at,
  }));
  const comments = (
    await listRows<CommentRow>(
      "SELECT * FROM reviewer_comments WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM reviewer_comments WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    reviewerUserId: row.reviewer_user_id,
    body: row.body,
    commentType: row.comment_type,
    createdAt: row.created_at,
  }));
  const editedOutputs = (
    await listRows<EditedOutputRow>(
      "SELECT * FROM edited_outputs WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM edited_outputs WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map(editedOutputFromRow);
  const approvals = (
    await listRows<ApprovalRow>(
      "SELECT * FROM approval_history WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM approval_history WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    approverUserId: row.approver_user_id,
    approvedOutput: parseJson<ReviewableOutput>(row.approved_output_json, {
      kind: "memo",
      title: "Unknown approval",
      body: "",
    }),
    approvedState: row.approved_state,
    createdAt: row.created_at,
  }));
  const feedbackLabels = (
    await listRows<FeedbackRow>(
      "SELECT * FROM feedback_labels WHERE workflow_id = ? ORDER BY created_at ASC",
      "SELECT * FROM feedback_labels WHERE workflow_id = $1 ORDER BY created_at ASC",
      workflow.id
    )
  ).map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    opportunityId: row.opportunity_id,
    reviewerUserId: row.reviewer_user_id,
    label: row.label,
    value: row.value,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  }));

  return {
    workflow,
    events,
    decisions,
    comments,
    editedOutputs,
    approvals,
    feedbackLabels,
  };
}

export async function getOrCreateWorkflowHistory(input: {
  opportunityId: string;
  opportunitySlug: string;
  originalOutput?: ReviewableOutput | null;
}) {
  await ensureReviewWorkflow(input);
  return getWorkflowHistory(input.opportunityId);
}
