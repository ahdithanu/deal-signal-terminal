# Human-in-the-Loop Review Workflow

## Purpose

Build Signals recommendations and AI memo outputs need human review before they become enterprise
deliverables. The workflow layer lets users submit, approve, reject, request changes, edit outputs,
export approved work, and preserve a full decision trail.

## State Machine

Workflow states:

- `new`: opportunity exists, no review activity yet.
- `ai_memo_drafted`: an AI output has been attached and preserved as the original output.
- `under_review`: a user submitted the item for review.
- `needs_human_review`: a reviewer requested changes or clarification.
- `revised`: a human edited AI output while preserving the original.
- `approved`: a reviewer approved the current output.
- `rejected`: a reviewer rejected the output or recommendation.
- `exported`: an approved output was marked exported.

Valid transitions are enforced in `src/lib/review-workflow.ts`; the frontend cannot bypass them.

## Persistence Model

The workflow uses dedicated tables:

- `review_workflows`: current state and original AI output.
- `workflow_events`: append-only transition history.
- `review_decisions`: approval, rejection, and change-request decisions.
- `reviewer_comments`: reviewer comments and rationale.
- `edited_outputs`: original output plus human-edited output, never silent overwrite.
- `approval_history`: approved output snapshots.
- `feedback_labels`: structured labels for prompt improvement and evaluation.

## API

`GET /api/opportunities/:slug/workflow`

Returns the current workflow and full history.

`POST /api/opportunities/:slug/workflow`

Supported actions:

- `submit_for_review`
- `approve`
- `reject`
- `request_changes`
- `edit_ai_output`
- `export`

Every action is authenticated, backend validated, and written to audit logs.

## Learning Loop

Human feedback is stored as structured labels, for example:

- `review_outcome: approved`
- `review_outcome: rejected`
- `review_outcome: needs_revision`
- `human_edit: edited_output`
- `unsupported_claim: removed`

Future prompt-evaluation jobs can compare original AI output, human-edited output, reviewer
comments, decision outcomes, and labels to identify recurring failure modes.

## Guardrails

- Original AI output is preserved separately from edited output.
- Approval snapshots are immutable history rows.
- Invalid transitions throw backend errors.
- Review actions are audited with org/user metadata.
- Review panels are clients of the state machine; they are not the source of truth.
