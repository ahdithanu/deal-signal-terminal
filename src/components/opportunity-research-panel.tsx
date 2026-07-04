"use client";

import { useEffect, useState } from "react";

import type { AgentRunResult, ResearchPacket } from "@/types/research";

function formatAgentName(agentName: string) {
  return agentName
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidenceLabel(confidence: number) {
  return `${Math.round(confidence * 100)}% confidence`;
}

function AgentCard({ result }: { result: AgentRunResult }) {
  const output = result.output;

  return (
    <div className="research-agent-card">
      <div className="research-agent-header">
        <div>
          <span className="copy-label">{formatAgentName(result.agentName)} agent</span>
          <h4>{output?.summary ?? "No structured output available."}</h4>
        </div>
        <span className={`status-pill status-pill-${result.status}`}>{result.status}</span>
      </div>
      {result.error ? <p className="form-error">{result.error}</p> : null}
      {output ? (
        <>
          <div className="subtle-text">
            {confidenceLabel(output.confidence)} · {result.latencyMs}ms · model {result.model}
          </div>
          {output.findings.length ? (
            <ul className="plain-list plain-list-tight">
              {output.findings.slice(0, 3).map((finding) => (
                <li key={`${result.agentName}-${finding.title}`}>
                  <strong>{finding.title}:</strong> {finding.detail}
                </li>
              ))}
            </ul>
          ) : null}
          {output.missingData.length ? (
            <p className="subtle-text">Missing: {output.missingData.slice(0, 4).join(", ")}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function OpportunityResearchPanel({ slug }: { slug: string }) {
  const [packet, setPacket] = useState<ResearchPacket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/opportunities/${slug}/research`);
        const payload = (await response.json()) as { packet?: ResearchPacket; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load research.");
        }

        if (!cancelled) {
          setPacket(payload.packet ?? null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load research.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function runResearch() {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/opportunities/${slug}/research`, {
        method: "POST",
      });
      const payload = (await response.json()) as { packet?: ResearchPacket; error?: string };

      if (!response.ok || !payload.packet) {
        throw new Error(payload.error ?? "Unable to run research.");
      }

      setPacket(payload.packet);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to run research.");
    } finally {
      setIsRunning(false);
    }
  }

  const specialistOutputs = packet?.outputs.filter((output) => output.agentName !== "coordinator") ?? [];

  return (
    <div className="panel research-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Multi-agent research</p>
          <h2 className="section-title">Evidence-backed opportunity intelligence</h2>
        </div>
        <button className="button" type="button" onClick={runResearch} disabled={isRunning}>
          {isRunning ? "Running agents..." : packet ? "Run again" : "Run multi-agent research"}
        </button>
      </div>

      <p className="tight-copy">
        Specialist agents review permits, property context, companies, risk, and market posture,
        then the coordinator synthesizes a final memo with citations, assumptions, confidence, and
        missing facts.
      </p>

      {isLoading ? <p className="subtle-text">Checking for prior research...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {packet ? (
        <>
          <div className="research-final-card">
            <span className="copy-label">Coordinator output</span>
            <h3>{packet.finalOutput.summary}</h3>
            <p className="tight-copy research-memo-copy">{packet.finalOutput.finalMemo}</p>
            <div className="subtle-text">
              {confidenceLabel(packet.finalOutput.confidence)} · {packet.outputs.length} agent
              outputs · {packet.totalTokenUsage.latencyMs}ms total latency
            </div>
          </div>

          <div className="research-agent-grid">
            {specialistOutputs.map((result) => (
              <AgentCard key={`${packet.runId}-${result.agentName}`} result={result} />
            ))}
          </div>

          {packet.finalOutput.conflictNotes.length ? (
            <div className="decision-card decision-card-muted">
              <span className="copy-label">Coordinator conflict notes</span>
              <ul className="plain-list plain-list-tight">
                {packet.finalOutput.conflictNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : !isLoading ? (
        <div className="empty-state-inline">
          <p className="tight-copy">
            No research packet has been generated yet. Run the agents to create a persisted,
            evidence-backed research record for this opportunity.
          </p>
        </div>
      ) : null}
    </div>
  );
}
