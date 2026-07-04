import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_DB_PATH = `${process.cwd()}/.data/test-copilot.db`;

describe("copilot", () => {
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

  it("routes workflow-specific intents from user questions", async () => {
    const { routeCopilotIntent } = await import("@/lib/copilot");

    expect(routeCopilotIntent("Explain the score for Quantum Care")).toBe("explain_score");
    expect(routeCopilotIntent("Compare Quantum Care against the storage fire")).toBe(
      "compare_opportunities"
    );
    expect(routeCopilotIntent("Write an IC memo")).toBe("generate_executive_memo");
    expect(routeCopilotIntent("What should we do next?")).toBe("recommend_next_action");
  });

  it("returns cited answers for opportunity questions", async () => {
    const { runCopilot } = await import("@/lib/copilot");

    const response = await runCopilot({
      question: "Why does Quantum Care matter?",
      opportunitySlug: "quantum-care-sales-office-trailer",
    });

    expect(response.refused).toBe(false);
    expect(response.directAnswer).toMatch(/Quantum Care|matters|next action/i);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.citations.every((citation) => citation.excerpt.length > 0)).toBe(true);
    expect(response.suggestedNextActions.length).toBeGreaterThan(0);
  });

  it("refuses to answer when evidence is missing", async () => {
    const { runCopilot } = await import("@/lib/copilot");

    const response = await runCopilot({ question: "   " });

    expect(response.refused).toBe(true);
    expect(response.citations).toHaveLength(0);
    expect(response.directAnswer).toMatch(/not have enough cited Build Signals evidence/i);
  });

  it("explains score using score citations", async () => {
    const { runCopilot } = await import("@/lib/copilot");

    const response = await runCopilot({
      question: "Explain the score for Quantum Care",
      opportunitySlug: "quantum-care-sales-office-trailer",
    });

    expect(response.intent).toBe("explain_score");
    expect(response.directAnswer).toMatch(/scores|contributor|limiter/i);
    expect(response.citations.some((citation) => citation.sourceType === "score")).toBe(true);
  });
});
