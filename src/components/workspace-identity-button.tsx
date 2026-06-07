"use client";

import { useState } from "react";

type IdentityResult = {
  orgName: string;
  orgSlug: string;
  adminEmail: string;
};

export function WorkspaceIdentityButton() {
  const [status, setStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [identity, setIdentity] = useState<IdentityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateIdentity() {
    setStatus("running");
    setIdentity(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/identity", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        identity?: IdentityResult;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.identity) {
        throw new Error(payload.error ?? "Workspace identity update failed");
      }

      setIdentity(payload.identity);
      setStatus("succeeded");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Workspace identity update failed"
      );
      setStatus("failed");
    }
  }

  return (
    <div className="ingestion-runner">
      <button
        className="button button-secondary"
        disabled={status === "running"}
        onClick={updateIdentity}
        type="button"
      >
        {status === "running" ? "Updating identity" : "Use Build Signals identity"}
      </button>
      {status === "succeeded" && identity ? (
        <p className="subtle-text">
          Workspace now uses {identity.orgName} and {identity.adminEmail}. Refresh after this
          completes.
        </p>
      ) : null}
      {status === "failed" && error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
