import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_DB_PATH = `${process.cwd()}/.data/test-ai-evals.db`;

describe("ai eval platform", () => {
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

  it("seeds default datasets for all critical AI workflows", async () => {
    const { listEvalDatasets } = await import("@/lib/ai-evals");

    const datasets = await listEvalDatasets();

    expect(datasets.map((dataset) => dataset.workflow)).toEqual([
      "copilot_answers",
      "opportunity_memos",
      "multi_agent_research",
      "score_explanations",
    ]);
    expect(datasets[0]?.cases.length).toBeGreaterThanOrEqual(2);
  });

  it("runs an eval dataset and stores run history with metrics", async () => {
    const { listEvalRuns, runEvalDataset } = await import("@/lib/ai-evals");

    const run = await runEvalDataset("copilot-answers-core");
    const runs = await listEvalRuns();

    expect(run.totalCases).toBeGreaterThan(0);
    expect(run.passedCases).toBe(run.totalCases);
    expect(run.averageScore).toBeGreaterThanOrEqual(0.8);
    expect(run.gatePassed).toBe(true);
    expect(run.results[0]?.metrics.some((metric) => metric.metricName === "citation_accuracy")).toBe(true);
    expect(runs[0]?.id).toBe(run.id);
  });

  it("compares runs and detects regressions", async () => {
    const { compareEvalRuns, runEvalDataset } = await import("@/lib/ai-evals");

    const first = await runEvalDataset("copilot-answers-core");
    const second = await runEvalDataset("copilot-answers-core");
    const comparison = await compareEvalRuns(first.id, second.id);

    expect(comparison.leftRunId).toBe(first.id);
    expect(comparison.rightRunId).toBe(second.id);
    expect(comparison.regressionDetected).toBe(false);
  });
});
