export type WorkflowState =
  | "new"
  | "under_review"
  | "ai_memo_drafted"
  | "needs_human_review"
  | "approved"
  | "rejected"
  | "revised"
  | "exported";

export type WorkflowAction =
  | "submit_for_review"
  | "approve"
  | "reject"
  | "request_changes"
  | "edit_ai_output"
  | "export";

export type ReviewDecision = "approved" | "rejected" | "changes_requested";

export type ReviewableOutput = {
  kind: "memo" | "research" | "opportunity_summary";
  title: string;
  body: string;
  summary?: string;
  generatedAt?: string;
  mode?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowEventRecord = {
  id: string;
  workflowId: string;
  opportunityId: string;
  actorUserId: string | null;
  actorOrgId: string | null;
  action: WorkflowAction;
  fromState: WorkflowState | null;
  toState: WorkflowState;
  comment: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReviewerCommentRecord = {
  id: string;
  workflowId: string;
  opportunityId: string;
  reviewerUserId: string | null;
  body: string;
  commentType: "general" | "approval" | "rejection" | "change_request" | "edit";
  createdAt: string;
};

export type EditedOutputRecord = {
  id: string;
  workflowId: string;
  opportunityId: string;
  editorUserId: string | null;
  originalOutput: ReviewableOutput;
  editedOutput: ReviewableOutput;
  editSummary: string | null;
  createdAt: string;
};

export type ApprovalHistoryRecord = {
  id: string;
  workflowId: string;
  opportunityId: string;
  approverUserId: string | null;
  approvedOutput: ReviewableOutput;
  approvedState: WorkflowState;
  createdAt: string;
};

export type FeedbackLabelRecord = {
  id: string;
  workflowId: string;
  opportunityId: string;
  reviewerUserId: string | null;
  label: string;
  value: string;
  targetType: "memo" | "recommendation" | "agent_output" | "opportunity";
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ReviewWorkflow = {
  id: string;
  opportunityId: string;
  opportunitySlug: string;
  state: WorkflowState;
  originalOutput: ReviewableOutput | null;
  currentEditedOutputId: string | null;
  createdAt: string;
  updatedAt: string;
  lastTransitionAt: string;
};

export type WorkflowHistory = {
  workflow: ReviewWorkflow;
  events: WorkflowEventRecord[];
  decisions: Array<{
    id: string;
    workflowId: string;
    opportunityId: string;
    reviewerUserId: string | null;
    decision: ReviewDecision;
    fromState: WorkflowState;
    toState: WorkflowState;
    rationale: string | null;
    createdAt: string;
  }>;
  comments: ReviewerCommentRecord[];
  editedOutputs: EditedOutputRecord[];
  approvals: ApprovalHistoryRecord[];
  feedbackLabels: FeedbackLabelRecord[];
};
