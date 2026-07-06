import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prompt-registry", () => ({
  activatePromptVersion: vi.fn(),
  createPromptVersion: vi.fn(),
  listPromptRegistryEvents: vi.fn(),
  listPromptTemplates: vi.fn(),
}));

describe("admin prompts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated reads", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getAuthSession).mockResolvedValue(null);
    const route = await import("@/app/api/admin/prompts/route");

    const response = await route.GET();

    expect(response.status).toBe(401);
  });

  it("returns prompt templates and registry events for admins", async () => {
    const auth = await import("@/lib/auth");
    const registry = await import("@/lib/prompt-registry");
    vi.mocked(auth.getAuthSession).mockResolvedValue({
      token: "token",
      userId: "user-1",
      orgId: "org-1",
      orgName: "Org",
      orgSlug: "org",
      email: "admin@test.local",
      name: "Admin",
      role: "admin",
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(registry.listPromptTemplates).mockResolvedValue([]);
    vi.mocked(registry.listPromptRegistryEvents).mockResolvedValue([]);
    const route = await import("@/app/api/admin/prompts/route");

    const response = await route.GET();

    await expect(response.json()).resolves.toEqual({ templates: [], events: [] });
  });

  it("creates prompt versions for admins", async () => {
    const auth = await import("@/lib/auth");
    const registry = await import("@/lib/prompt-registry");
    vi.mocked(auth.getAuthSession).mockResolvedValue({
      token: "token",
      userId: "user-1",
      orgId: "org-1",
      orgName: "Org",
      orgSlug: "org",
      email: "admin@test.local",
      name: "Admin",
      role: "admin",
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(registry.createPromptVersion).mockResolvedValue({
      id: "version-1",
      templateId: "template-1",
      version: "v2",
      status: "draft",
      promptBody: "body",
      variables: [],
      outputSchema: {},
      modelFamily: "structured-chat",
      changelog: "change",
      createdByUserId: "user-1",
      createdAt: "now",
      activatedAt: null,
    });
    const route = await import("@/app/api/admin/prompts/route");

    const response = await route.POST(
      new Request("https://example.com/api/admin/prompts", {
        method: "POST",
        body: JSON.stringify({
          action: "create_version",
          promptKey: "copilot.answer.v1",
          version: "v2",
          promptBody: "Prompt body with enough length.",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("activates prompt versions for admins", async () => {
    const auth = await import("@/lib/auth");
    const registry = await import("@/lib/prompt-registry");
    vi.mocked(auth.getAuthSession).mockResolvedValue({
      token: "token",
      userId: "user-1",
      orgId: "org-1",
      orgName: "Org",
      orgSlug: "org",
      email: "admin@test.local",
      name: "Admin",
      role: "admin",
      expiresAt: new Date().toISOString(),
    });
    vi.mocked(registry.activatePromptVersion).mockResolvedValue({
      id: "template-1",
      promptKey: "copilot.answer.v1",
      name: "Copilot",
      description: "Prompt",
      workflow: "copilot_answers",
      status: "active",
      activeVersionId: "version-1",
      createdAt: "now",
      updatedAt: "now",
      activeVersion: null,
      versions: [],
    });
    const route = await import("@/app/api/admin/prompts/route");

    const response = await route.POST(
      new Request("https://example.com/api/admin/prompts", {
        method: "POST",
        body: JSON.stringify({
          action: "activate_version",
          promptKey: "copilot.answer.v1",
          versionId: "version-1",
        }),
      })
    );

    expect(response.status).toBe(200);
  });
});
