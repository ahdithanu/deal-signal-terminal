import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_DB_PATH = `${process.cwd()}/.data/test-prompt-registry.db`;

describe("prompt registry", () => {
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

  it("seeds default prompt templates for critical AI workflows", async () => {
    const { listPromptTemplates } = await import("@/lib/prompt-registry");

    const templates = await listPromptTemplates();

    expect(templates.map((template) => template.workflow).sort()).toEqual([
      "copilot_answers",
      "multi_agent_research",
      "opportunity_memos",
      "score_explanations",
    ]);
    expect(templates.every((template) => template.activeVersion)).toBe(true);
  });

  it("creates draft prompt versions and activates them with history", async () => {
    const { createPromptVersion, activatePromptVersion, getPromptTemplate, listPromptRegistryEvents } =
      await import("@/lib/prompt-registry");

    const draft = await createPromptVersion({
      promptKey: "copilot.answer.v1",
      version: "copilot-answer-v2",
      promptBody:
        "Answer from retrieved Build Signals context, preserve citations, and refuse when evidence is missing.",
      variables: ["question", "sourceEvidence"],
      outputSchema: { directAnswer: "string", citations: "array" },
      modelFamily: "structured-chat",
      changelog: "Tighten refusal behavior.",
      createdByUserId: "user-1",
    });

    expect(draft.status).toBe("draft");

    const activated = await activatePromptVersion({
      promptKey: "copilot.answer.v1",
      versionId: draft.id,
      userId: "user-1",
    });
    const template = await getPromptTemplate("copilot.answer.v1");
    const events = await listPromptRegistryEvents();

    expect(activated?.activeVersionId).toBe(draft.id);
    expect(template?.activeVersion?.version).toBe("copilot-answer-v2");
    expect(events.some((event) => event.action === "version.activate")).toBe(true);
  });
});
