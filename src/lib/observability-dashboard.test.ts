import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_DB_PATH = `${process.cwd()}/.data/test-observability.db`;

describe("observability dashboard", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;

    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();
  });

  afterEach(async () => {
    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("aggregates AI workflow health and detects failed eval gates", async () => {
    const { getDatabase } = await import("@/lib/db");
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO copilot_runs (
        id, org_id, user_id, query, intent, retrieved_context_json, response_json,
        model, prompt_tokens, completion_tokens, latency_ms, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "copilot-1",
      "org-1",
      "user-1",
      "Why does this matter?",
      "summarize_opportunity",
      "{}",
      "{}",
      "deterministic",
      100,
      50,
      1200,
      null,
      now
    );
    db.prepare(
      `INSERT INTO copilot_runs (
        id, org_id, user_id, query, intent, retrieved_context_json, response_json,
        model, prompt_tokens, completion_tokens, latency_ms, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "copilot-2",
      "org-1",
      "user-1",
      "Compare deals",
      "compare_opportunities",
      "{}",
      "{}",
      "deterministic",
      80,
      40,
      40_000,
      "retrieval failed",
      now
    );
    db.prepare(
      `INSERT INTO eval_dataset (
        id, name, description, workflow, critical_threshold, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "copilot-answers-core",
      "Copilot answers core",
      "Core Copilot regressions",
      "copilot_answers",
      0.8,
      now,
      now
    );
    db.prepare(
      `INSERT INTO eval_run (
        id, dataset_id, status, prompt_version, model, started_at, finished_at,
        total_cases, passed_cases, average_score, gate_threshold, gate_passed,
        total_prompt_tokens, total_completion_tokens, total_cost_usd, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "eval-1",
      "copilot-answers-core",
      "failed",
      "v1",
      "deterministic",
      now,
      now,
      4,
      2,
      0.5,
      0.8,
      0,
      100,
      40,
      0,
      "{}"
    );

    const { getObservabilityDashboard } = await import("@/lib/observability-dashboard");
    const dashboard = await getObservabilityDashboard({ orgId: "org-1" });

    expect(dashboard.status).toBe("critical");
    expect(dashboard.workflows.find((workflow) => workflow.workflow === "copilot")?.failures).toBe(1);
    expect(dashboard.workflows.find((workflow) => workflow.workflow === "evals")?.status).toBe(
      "critical"
    );
    expect(dashboard.timeline.some((event) => event.source === "copilot")).toBe(true);
    expect(dashboard.recommendations).toContain(
      "Block AI prompt/model rollout until the latest eval gate passes."
    );
  });

  it("records open incidents and surfaces them in the dashboard", async () => {
    const { recordObservabilityIncident, getObservabilityDashboard } = await import(
      "@/lib/observability-dashboard"
    );

    const incident = await recordObservabilityIncident({
      orgId: "org-1",
      severity: "critical",
      title: "Copilot latency spike",
      source: "copilot",
      summary: "P95 latency crossed the customer demo threshold.",
      metadata: { p95LatencyMs: 45_000 },
    });
    const dashboard = await getObservabilityDashboard({ orgId: "org-1" });

    expect(incident.status).toBe("open");
    expect(dashboard.incidents).toHaveLength(1);
    expect(dashboard.status).toBe("critical");
    expect(dashboard.timeline[0]?.title).toBe("Copilot latency spike");
  });
});
