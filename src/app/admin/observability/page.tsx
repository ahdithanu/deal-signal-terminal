import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { getObservabilityDashboard } from "@/lib/observability-dashboard";
import type { ObservabilityStatus } from "@/types/observability";

function formatLatency(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "No activity";
}

function statusClass(status: ObservabilityStatus) {
  return status === "healthy" ? "chip chip-accent" : "chip";
}

export default async function AdminObservabilityPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const dashboard = await getObservabilityDashboard({ orgId: session.orgId });

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">AI operations</p>
            <h1 className="detail-title">Observability dashboard</h1>
            <p className="tight-copy">
              Monitor AI workflow health, ingestion reliability, eval gates, auth pressure, and
              operational incidents from one admin surface.
            </p>
          </div>
          <div>
            <span className={statusClass(dashboard.status)}>{dashboard.status}</span>
            <p className="subtle-text">Generated {formatTime(dashboard.generatedAt)}</p>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        {dashboard.metrics.slice(0, 4).map((metric) => (
          <div className="panel" key={metric.key}>
            <p className="eyebrow">{metric.label}</p>
            <strong className="metric-value metric-value-text">
              {metric.value}
              {metric.unit ? <span className="table-subtext"> {metric.unit}</span> : null}
            </strong>
            <p className="subtle-text">{metric.description}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Workflow SLOs</p>
            <h2 className="section-title">Critical path telemetry</h2>
          </div>
          <div className="subtle-text">
            DB: {dashboard.database.provider} · runtime{" "}
            {dashboard.database.runtimeReady ? "ready" : "not ready"}
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Status</th>
              <th>Runs</th>
              <th>Failures</th>
              <th>Failure rate</th>
              <th>Avg latency</th>
              <th>P95 latency</th>
              <th>Tokens</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.workflows.map((workflow) => (
              <tr key={workflow.workflow}>
                <td>
                  <strong>{workflow.workflow}</strong>
                </td>
                <td>
                  <span className={statusClass(workflow.status)}>{workflow.status}</span>
                </td>
                <td>{workflow.runs}</td>
                <td>{workflow.failures}</td>
                <td>{Math.round(workflow.failureRate * 100)}%</td>
                <td>{formatLatency(workflow.averageLatencyMs)}</td>
                <td>{formatLatency(workflow.p95LatencyMs)}</td>
                <td>{workflow.promptTokens + workflow.completionTokens}</td>
                <td>{formatTime(workflow.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Recommended actions</p>
          <h2 className="section-title">What to fix before a customer demo</h2>
          <ul className="plain-list">
            {dashboard.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <p className="eyebrow">Open incidents</p>
          <h2 className="section-title">Operational risk register</h2>
          {dashboard.incidents.length === 0 ? (
            <p className="tight-copy">No open incidents.</p>
          ) : (
            <ul className="plain-list">
              {dashboard.incidents.map((incident) => (
                <li key={incident.id}>
                  <strong>{incident.title}</strong> · {incident.severity} · {incident.status}
                  <div className="table-subtext">{incident.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2 className="section-title">Recent operational events</h2>
          </div>
          <div className="subtle-text">{dashboard.timeline.length} notable events</div>
        </div>
        {dashboard.timeline.length === 0 ? (
          <p className="tight-copy">No failures or incidents in the active window.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Severity</th>
                <th>Event</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.timeline.map((event) => (
                <tr key={event.id}>
                  <td>{formatTime(event.occurredAt)}</td>
                  <td>{event.source}</td>
                  <td>{event.severity}</td>
                  <td>{event.title}</td>
                  <td>{event.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
