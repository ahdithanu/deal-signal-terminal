import crypto from "node:crypto";

import { getDatabase, getDatabaseInfo, resolveDatabaseProvider } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import type {
  ObservabilityDashboard,
  ObservabilityIncident,
  ObservabilityIncidentSeverity,
  ObservabilityIncidentStatus,
  ObservabilityMetric,
  ObservabilityStatus,
  ObservabilityTimelineEvent,
  ObservabilityWorkflowMetric,
} from "@/types/observability";

type MetricRow = {
  id?: string;
  status?: string;
  latency_ms?: number;
  total_latency_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  records_found?: number;
  error_message?: string | null;
  created_at?: string;
  started_at?: string;
  finished_at?: string | null;
  occurred_at?: string;
  action?: string;
  resource_type?: string;
  average_score?: number;
  gate_passed?: boolean | number;
};

type IncidentRow = {
  id: string;
  org_id: string | null;
  severity: ObservabilityIncidentSeverity;
  status: ObservabilityIncidentStatus;
  title: string;
  source: string;
  started_at: string;
  resolved_at: string | null;
  summary: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type RecordIncidentInput = {
  orgId?: string | null;
  severity: ObservabilityIncidentSeverity;
  status?: ObservabilityIncidentStatus;
  title: string;
  source: string;
  summary: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  resolvedAt?: string | null;
};

const DEFAULT_WINDOW_HOURS = 24;
type SqlValue = string | number | null;

function nowIso() {
  return new Date().toISOString();
}

function windowStartIso(windowHours: number) {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function statusRank(status: ObservabilityStatus) {
  return status === "critical" ? 3 : status === "degraded" ? 2 : 1;
}

function worstStatus(statuses: ObservabilityStatus[]): ObservabilityStatus {
  return statuses.reduce<ObservabilityStatus>(
    (worst, next) => (statusRank(next) > statusRank(worst) ? next : worst),
    "healthy"
  );
}

function statusForFailureRate(total: number, failures: number): ObservabilityStatus {
  if (total === 0) {
    return "healthy";
  }

  const rate = failures / total;

  if (rate >= 0.1) {
    return "critical";
  }

  if (rate >= 0.02) {
    return "degraded";
  }

  return "healthy";
}

function statusForLatency(p95LatencyMs: number): ObservabilityStatus {
  if (p95LatencyMs >= 30_000) {
    return "critical";
  }

  if (p95LatencyMs >= 10_000) {
    return "degraded";
  }

  return "healthy";
}

function rowTime(row: MetricRow) {
  return row.created_at ?? row.finished_at ?? row.started_at ?? row.occurred_at ?? null;
}

function workflowMetric(
  workflow: ObservabilityWorkflowMetric["workflow"],
  rows: MetricRow[],
  options: { evalGateAware?: boolean } = {}
): ObservabilityWorkflowMetric {
  const latencies = rows.map((row) => Number(row.latency_ms ?? row.total_latency_ms ?? 0));
  const failures = rows.filter((row) => {
    if (workflow === "evals" && options.evalGateAware) {
      return row.status === "failed" || row.status === "error" || row.gate_passed === false || row.gate_passed === 0;
    }

    return Boolean(row.error_message) || row.status === "failed" || row.status === "error";
  }).length;
  const p95LatencyMs = percentile(latencies, 95);
  const status = worstStatus([
    statusForFailureRate(rows.length, failures),
    statusForLatency(p95LatencyMs),
  ]);
  const lastSeenAt = rows
    .map(rowTime)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    workflow,
    runs: rows.length,
    failures,
    failureRate: rows.length === 0 ? 0 : failures / rows.length,
    averageLatencyMs:
      latencies.length === 0
        ? 0
        : Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length),
    p95LatencyMs,
    promptTokens: rows.reduce(
      (sum, row) => sum + Number(row.prompt_tokens ?? row.total_prompt_tokens ?? 0),
      0
    ),
    completionTokens: rows.reduce(
      (sum, row) => sum + Number(row.completion_tokens ?? row.total_completion_tokens ?? 0),
      0
    ),
    lastSeenAt: lastSeenAt ?? null,
    status,
  };
}

function incidentFromRow(row: IncidentRow): ObservabilityIncident {
  return {
    id: row.id,
    orgId: row.org_id,
    severity: row.severity,
    status: row.status,
    title: row.title,
    source: row.source,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    summary: row.summary,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function selectRows<T extends MetricRow>(sqliteSql: string, postgresSql: string, values: SqlValue[]) {
  if (resolveDatabaseProvider() === "postgres") {
    return (await queryPostgres<T>(postgresSql, values)).rows;
  }

  return getDatabase().prepare(sqliteSql).all(...values) as T[];
}

async function selectIncidentRows(sqliteSql: string, postgresSql: string, values: SqlValue[]) {
  if (resolveDatabaseProvider() === "postgres") {
    return (await queryPostgres<IncidentRow>(postgresSql, values)).rows;
  }

  return getDatabase().prepare(sqliteSql).all(...values) as IncidentRow[];
}

function metric(
  key: string,
  label: string,
  value: number | string,
  status: ObservabilityStatus,
  description: string,
  unit?: string
): ObservabilityMetric {
  return { key, label, value, unit, status, description };
}

function timelineFromRows(rows: MetricRow[], source: string): ObservabilityTimelineEvent[] {
  return rows
    .filter((row) => Boolean(row.error_message) || row.status === "failed" || row.status === "error")
    .map((row) => ({
      id: row.id ?? `${source}-${rowTime(row) ?? crypto.randomUUID()}`,
      occurredAt: rowTime(row) ?? nowIso(),
      source,
      severity: "warning",
      title: `${source} failure`,
      detail: row.error_message ?? `${source} reported ${row.status}`,
    }));
}

export async function recordObservabilityIncident(
  input: RecordIncidentInput
): Promise<ObservabilityIncident> {
  const timestamp = nowIso();
  const incident: ObservabilityIncident = {
    id: crypto.randomUUID(),
    orgId: input.orgId ?? null,
    severity: input.severity,
    status: input.status ?? "open",
    title: input.title,
    source: input.source,
    startedAt: input.startedAt ?? timestamp,
    resolvedAt: input.resolvedAt ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const values = [
    incident.id,
    incident.orgId,
    incident.severity,
    incident.status,
    incident.title,
    incident.source,
    incident.startedAt,
    incident.resolvedAt,
    incident.summary,
    JSON.stringify(incident.metadata),
    incident.createdAt,
    incident.updatedAt,
  ];

  if (resolveDatabaseProvider() === "postgres") {
    await queryPostgres(
      `INSERT INTO observability_incidents (
        id, org_id, severity, status, title, source, started_at, resolved_at,
        summary, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      values
    );
  } else {
    getDatabase()
      .prepare(
        `INSERT INTO observability_incidents (
          id, org_id, severity, status, title, source, started_at, resolved_at,
          summary, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values);
  }

  return incident;
}

export async function getObservabilityDashboard(options: {
  orgId?: string | null;
  windowHours?: number;
} = {}): Promise<ObservabilityDashboard> {
  const windowHours = options.windowHours ?? DEFAULT_WINDOW_HOURS;
  const since = windowStartIso(windowHours);
  const database = getDatabaseInfo();

  const [copilotRows, researchRows, ingestionRows, evalRows, auditRows, incidentRows] =
    await Promise.all([
      selectRows<MetricRow>(
        "SELECT * FROM copilot_runs WHERE created_at >= ? ORDER BY created_at DESC",
        "SELECT * FROM copilot_runs WHERE created_at >= $1 ORDER BY created_at DESC",
        [since]
      ),
      selectRows<MetricRow>(
        "SELECT * FROM agent_research_runs WHERE started_at >= ? ORDER BY started_at DESC",
        "SELECT * FROM agent_research_runs WHERE started_at >= $1 ORDER BY started_at DESC",
        [since]
      ),
      selectRows<MetricRow>(
        "SELECT * FROM ingestion_runs WHERE started_at >= ? ORDER BY started_at DESC",
        "SELECT * FROM ingestion_runs WHERE started_at >= $1 ORDER BY started_at DESC",
        [since]
      ),
      selectRows<MetricRow>(
        "SELECT * FROM eval_run WHERE started_at >= ? ORDER BY started_at DESC",
        "SELECT * FROM eval_run WHERE started_at >= $1 ORDER BY started_at DESC",
        [since]
      ),
      selectRows<MetricRow>(
        "SELECT * FROM audit_events WHERE occurred_at >= ? ORDER BY occurred_at DESC LIMIT 100",
        "SELECT * FROM audit_events WHERE occurred_at >= $1 ORDER BY occurred_at DESC LIMIT 100",
        [since]
      ),
      selectIncidentRows(
        "SELECT * FROM observability_incidents WHERE status != 'resolved' ORDER BY started_at DESC LIMIT 25",
        "SELECT * FROM observability_incidents WHERE status != 'resolved' ORDER BY started_at DESC LIMIT 25",
        []
      ),
    ]);

  const workflows = [
    workflowMetric("copilot", copilotRows),
    workflowMetric("research", researchRows),
    workflowMetric("ingestion", ingestionRows),
    workflowMetric("evals", evalRows, { evalGateAware: true }),
    workflowMetric("audit", auditRows),
  ];
  const incidents = incidentRows.map(incidentFromRow);
  const latestEval = evalRows[0];
  const openCriticalIncidents = incidents.filter((incident) => incident.severity === "critical");
  const status = worstStatus([
    database.runtimeReady ? "healthy" : "critical",
    ...workflows.map((workflow) => workflow.status),
    openCriticalIncidents.length > 0 ? "critical" : incidents.length > 0 ? "degraded" : "healthy",
  ]);
  const authFailures = auditRows.filter((row) => row.action === "login_failed").length;
  const totalTokens = workflows.reduce(
    (sum, workflow) => sum + workflow.promptTokens + workflow.completionTokens,
    0
  );

  const metrics = [
    metric(
      "service_status",
      "Service status",
      status,
      status,
      "Worst status across database readiness, critical workflows, and open incidents."
    ),
    metric(
      "open_incidents",
      "Open incidents",
      incidents.length,
      incidents.some((incident) => incident.severity === "critical")
        ? "critical"
        : incidents.length > 0
          ? "degraded"
          : "healthy",
      "Active operational incidents recorded by the Build Signals team."
    ),
    metric(
      "copilot_failure_rate",
      "Copilot failure rate",
      `${Math.round(workflows[0].failureRate * 100)}%`,
      workflows[0].status,
      "Share of Copilot requests with errors in the active window."
    ),
    metric(
      "research_p95_latency",
      "Research p95 latency",
      workflows[1].p95LatencyMs,
      statusForLatency(workflows[1].p95LatencyMs),
      "95th percentile multi-agent research latency.",
      "ms"
    ),
    metric(
      "latest_eval_score",
      "Latest eval score",
      latestEval ? `${Math.round(Number(latestEval.average_score ?? 0) * 100)}%` : "not run",
      latestEval && (latestEval.gate_passed === false || latestEval.gate_passed === 0)
        ? "critical"
        : "healthy",
      "Most recent AI evaluation run score and regression gate outcome."
    ),
    metric(
      "auth_failures",
      "Auth failures",
      authFailures,
      authFailures >= 10 ? "degraded" : "healthy",
      "Failed login events in the active window."
    ),
    metric("token_volume", "AI token volume", totalTokens, "healthy", "Approximate AI token volume.", "tokens"),
  ];

  const timeline = [
    ...incidents.map<ObservabilityTimelineEvent>((incident) => ({
      id: incident.id,
      occurredAt: incident.startedAt,
      source: incident.source,
      severity: incident.severity,
      title: incident.title,
      detail: incident.summary,
    })),
    ...timelineFromRows(copilotRows, "copilot"),
    ...timelineFromRows(researchRows, "research"),
    ...timelineFromRows(ingestionRows, "ingestion"),
    ...timelineFromRows(evalRows, "evals"),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 20);

  const recommendations = [
    !database.runtimeReady ? "Fix database configuration before running customer demos." : null,
    workflows[0].status !== "healthy"
      ? "Review Copilot errors and retrieval context before changing prompts."
      : null,
    workflows[2].status !== "healthy"
      ? "Inspect ingestion failures and source availability for stale market data."
      : null,
    latestEval && (latestEval.gate_passed === false || latestEval.gate_passed === 0)
      ? "Block AI prompt/model rollout until the latest eval gate passes."
      : null,
    incidents.length > 0 ? "Resolve or annotate open incidents before enterprise demos." : null,
  ].filter((value): value is string => Boolean(value));

  return {
    generatedAt: nowIso(),
    status,
    database: {
      provider: database.provider,
      runtimeReady: database.runtimeReady,
      postgresUrlConfigured: database.postgresUrlConfigured,
    },
    metrics,
    workflows,
    incidents,
    timeline,
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["No immediate operational action required in the active window."],
  };
}
