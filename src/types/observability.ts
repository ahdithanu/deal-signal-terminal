export type ObservabilityStatus = "healthy" | "degraded" | "critical";

export type ObservabilityIncidentSeverity = "info" | "warning" | "critical";

export type ObservabilityIncidentStatus = "open" | "investigating" | "resolved";

export type ObservabilityMetric = {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  status: ObservabilityStatus;
  description: string;
};

export type ObservabilityWorkflowMetric = {
  workflow: "copilot" | "research" | "ingestion" | "evals" | "audit";
  runs: number;
  failures: number;
  failureRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  lastSeenAt: string | null;
  status: ObservabilityStatus;
};

export type ObservabilityIncident = {
  id: string;
  orgId: string | null;
  severity: ObservabilityIncidentSeverity;
  status: ObservabilityIncidentStatus;
  title: string;
  source: string;
  startedAt: string;
  resolvedAt: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ObservabilityTimelineEvent = {
  id: string;
  occurredAt: string;
  source: string;
  severity: ObservabilityIncidentSeverity;
  title: string;
  detail: string;
};

export type ObservabilityDashboard = {
  generatedAt: string;
  status: ObservabilityStatus;
  database: {
    provider: string;
    runtimeReady: boolean;
    postgresUrlConfigured: boolean;
  };
  metrics: ObservabilityMetric[];
  workflows: ObservabilityWorkflowMetric[];
  incidents: ObservabilityIncident[];
  timeline: ObservabilityTimelineEvent[];
  recommendations: string[];
};
