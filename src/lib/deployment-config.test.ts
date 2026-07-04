import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-deployment-config.db`;

describe("workspace deployment config", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;

    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();

    const db = dbModule.getDatabase();
    db.prepare("INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)").run(
      "org-test",
      "Test Org",
      "test-org"
    );
  });

  afterEach(async () => {
    const dbModule = await import("@/lib/db");
    dbModule.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("returns safe defaults before a workspace override exists", async () => {
    const { getWorkspaceDeploymentConfig } = await import("@/lib/deployment-config");

    const config = await getWorkspaceDeploymentConfig("org-test");

    expect(config.orgId).toBe("org-test");
    expect(config.modelProvider).toBe("openai");
    expect(config.modelSecretRef).toBe("env:OPENAI_API_KEY");
    expect(config.retrievalDepth).toBeGreaterThan(0);
    expect(config.featureFlags.humanReviewWorkflow).toBe(true);
  });

  it("persists workspace overrides and change history", async () => {
    const {
      getWorkspaceDeploymentConfig,
      listWorkspaceDeploymentConfigHistory,
      updateWorkspaceDeploymentConfig,
    } = await import("@/lib/deployment-config");

    await updateWorkspaceDeploymentConfig({
      orgId: "org-test",
      userId: "user-admin",
      input: {
        modelProvider: "anthropic",
        modelName: "claude-enterprise",
        modelSecretRef: "env:ANTHROPIC_API_KEY",
        retrievalDepth: 14,
        confidenceThreshold: 0.81,
      },
    });

    const config = await getWorkspaceDeploymentConfig("org-test");
    const history = await listWorkspaceDeploymentConfigHistory("org-test");

    expect(config.modelProvider).toBe("anthropic");
    expect(config.modelName).toBe("claude-enterprise");
    expect(config.retrievalDepth).toBe(14);
    expect(config.confidenceThreshold).toBe(0.81);
    expect(history.map((event) => event.section)).toContain("ai_models");
    expect(history.map((event) => event.section)).toContain("retrieval");
    expect(history[0]?.userId).toBe("user-admin");
  });

  it("rejects invalid thresholds and leaves the previous config intact", async () => {
    const {
      DeploymentConfigValidationError,
      getWorkspaceDeploymentConfig,
      updateWorkspaceDeploymentConfig,
    } = await import("@/lib/deployment-config");

    await expect(
      updateWorkspaceDeploymentConfig({
        orgId: "org-test",
        userId: "user-admin",
        input: { confidenceThreshold: 1.5 },
      })
    ).rejects.toBeInstanceOf(DeploymentConfigValidationError);

    const config = await getWorkspaceDeploymentConfig("org-test");
    expect(config.confidenceThreshold).toBe(0.72);
  });

  it("rejects plaintext secrets in customer configuration", async () => {
    const { updateWorkspaceDeploymentConfig } = await import("@/lib/deployment-config");

    await expect(
      updateWorkspaceDeploymentConfig({
        orgId: "org-test",
        userId: "user-admin",
        input: { modelSecretRef: "sk-live-plaintext" },
      })
    ).rejects.toThrow(/secure reference/);
  });
});
