"use client";

import { useState, useTransition } from "react";

export function EvalRunButton({ datasetId, compact = false }: { datasetId: string; compact?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runEval() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/evals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ datasetId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Eval run failed.");
        return;
      }

      setMessage(
        `Run ${payload.run.status}: ${payload.run.passedCases}/${payload.run.totalCases} passed at ${Math.round(
          payload.run.averageScore * 100
        )}%. Gate ${payload.run.gatePassed ? "passed" : "failed"}. Refresh to view the run history.`
      );
    });
  }

  return (
    <div className="admin-action-stack">
      <button className="button" disabled={isPending} onClick={runEval} type="button">
        {isPending ? "Running..." : compact ? "Run" : "Run eval suite"}
      </button>
      {!compact && message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
