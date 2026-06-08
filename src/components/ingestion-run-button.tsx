"use client";

import { useState } from "react";

type IngestionResult = {
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
};

type IngestionRunButtonProps = {
  endpoint?: string;
  label?: string;
  runningLabel?: string;
};

export function IngestionRunButton({
  endpoint = "/api/admin/ingest/eldorado",
  label = "Run El Dorado ingest",
  runningLabel = "Running ingest",
}: IngestionRunButtonProps) {
  const [status, setStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runIngestion() {
    setStatus("running");
    setResult(null);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: IngestionResult;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Ingestion failed");
      }

      setResult(payload.result);
      setStatus("succeeded");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Ingestion failed");
      setStatus("failed");
    }
  }

  return (
    <div className="ingestion-runner">
      <button className="button" disabled={status === "running"} onClick={runIngestion} type="button">
        {status === "running" ? runningLabel : label}
      </button>
      {status === "succeeded" && result ? (
        <p className="subtle-text">
          Stored {result.recordsFound} records: {result.recordsInserted} inserted,{" "}
          {result.recordsUpdated} updated.
        </p>
      ) : null}
      {status === "failed" && error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
