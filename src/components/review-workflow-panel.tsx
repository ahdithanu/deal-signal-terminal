"use client";

import { useEffect, useMemo, useState } from "react";

import type { ReviewableOutput, WorkflowHistory } from "@/types/workflow";

function stateLabel(value: string) {
  return value.replace(/_/g, " ");
}

async function readHistory(slug: string): Promise<WorkflowHistory> {
  const response = await fetch(`/api/opportunities/${slug}/workflow`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await response.json()) as { history?: WorkflowHistory; error?: string };

  if (!response.ok || !payload.history) {
    throw new Error(payload.error ?? "Unable to load workflow history.");
  }

  return payload.history;
}

async function postWorkflowAction(
  slug: string,
  body: Record<string, unknown>
): Promise<WorkflowHistory> {
  const response = await fetch(`/api/opportunities/${slug}/workflow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { history?: WorkflowHistory; error?: string };

  if (!response.ok || !payload.history) {
    throw new Error(payload.error ?? "Workflow action failed.");
  }

  return payload.history;
}

export function ReviewWorkflowPanel({
  slug,
  opportunityId,
  initialOutput,
}: {
  slug: string;
  opportunityId: string;
  initialOutput?: ReviewableOutput;
}) {
  const [history, setHistory] = useState<WorkflowHistory | null>(null);
  const [comment, setComment] = useState("");
  const [editBody, setEditBody] = useState(initialOutput?.body ?? "");
  const [editSummary, setEditSummary] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readHistory(slug)
      .then((nextHistory) => {
        if (!cancelled) {
          setHistory(nextHistory);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load workflow.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const currentOutput = useMemo(() => {
    const latestEdit = history?.editedOutputs[history.editedOutputs.length - 1];
    return latestEdit?.editedOutput ?? history?.workflow.originalOutput ?? initialOutput ?? null;
  }, [history, initialOutput]);

  useEffect(() => {
    if (currentOutput?.body) {
      setEditBody(currentOutput.body);
    }
  }, [currentOutput?.body]);

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setIsBusy(true);
    setError(null);

    try {
      const nextHistory = await postWorkflowAction(slug, {
        action,
        comment,
        rationale: comment,
        originalOutput: initialOutput ?? currentOutput,
        feedbackLabels:
          action === "approve"
            ? [{ label: "review_outcome", value: "approved", targetType: "memo" }]
            : action === "reject"
              ? [{ label: "review_outcome", value: "rejected", targetType: "memo" }]
              : action === "request_changes"
                ? [{ label: "review_outcome", value: "needs_revision", targetType: "memo" }]
                : [],
        ...extra,
      });
      setHistory(nextHistory);
      setComment("");
      setEditSummary("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Workflow action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const outputForEdit: ReviewableOutput | null = currentOutput
    ? {
        ...currentOutput,
        body: editBody,
      }
    : initialOutput
      ? {
          ...initialOutput,
          body: editBody,
        }
      : null;

  return (
    <div className="panel review-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Human review</p>
          <h2 className="section-title">Review workflow</h2>
        </div>
        <div className="status-pill">
          {history ? stateLabel(history.workflow.state) : "loading"}
        </div>
      </div>

      <p className="tight-copy">
        Review actions are backend-enforced and audited. AI output is preserved separately from
        human-edited output for later prompt evaluation.
      </p>

      {error ? <p className="form-error">{error}</p> : null}

      <textarea
        className="note-field"
        onChange={(event) => setComment(event.target.value)}
        placeholder="Reviewer comment, approval rationale, or requested changes."
        rows={3}
        value={comment}
      />

      <div className="review-action-row">
        <button
          className="button"
          disabled={isBusy}
          onClick={() => runAction("submit_for_review")}
          type="button"
        >
          Submit for review
        </button>
        <button
          className="button button-secondary"
          disabled={isBusy}
          onClick={() => runAction("request_changes")}
          type="button"
        >
          Request changes
        </button>
        <button
          className="button"
          disabled={isBusy}
          onClick={() => runAction("approve")}
          type="button"
        >
          Approve
        </button>
        <button
          className="button button-secondary"
          disabled={isBusy}
          onClick={() => runAction("reject")}
          type="button"
        >
          Reject
        </button>
      </div>

      {currentOutput || initialOutput ? (
        <div className="review-edit-card">
          <span className="copy-label">Human edit layer</span>
          <textarea
            className="note-field"
            onChange={(event) => setEditBody(event.target.value)}
            rows={7}
            value={editBody}
          />
          <input
            className="field-input"
            onChange={(event) => setEditSummary(event.target.value)}
            placeholder="Edit summary, e.g. tightened recommendation and removed unsupported claim"
            value={editSummary}
          />
          <button
            className="button"
            disabled={isBusy || !outputForEdit}
            onClick={() =>
              outputForEdit
                ? runAction("edit_ai_output", {
                    editedOutput: outputForEdit,
                    editSummary,
                    feedbackLabels: [
                      { label: "human_edit", value: "edited_output", targetType: "memo" },
                    ],
                  })
                : undefined
            }
            type="button"
          >
            Save human edit
          </button>
        </div>
      ) : (
        <p className="subtle-text">
          No AI output has been attached yet. Generate or open the memo page to submit memo text for
          review.
        </p>
      )}

      <div className="review-history-stack">
        <span className="copy-label">Decision history</span>
        {history?.events.length ? (
          history.events
            .slice()
            .reverse()
            .map((event) => (
              <div className="review-history-row" key={event.id}>
                <strong>
                  {event.action.replace(/_/g, " ")} → {stateLabel(event.toState)}
                </strong>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                {event.comment ? <p className="tight-copy">{event.comment}</p> : null}
              </div>
            ))
        ) : (
          <p className="subtle-text">No review actions yet for {opportunityId}.</p>
        )}
      </div>
    </div>
  );
}
