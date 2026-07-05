import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/ai-evals", () => ({
  compareEvalRuns: vi.fn(),
  createEvalDataset: vi.fn(),
  listEvalRuns: vi.fn(),
  listEvalDatasets: vi.fn(),
  runEvalDataset: vi.fn(),
}));

describe("admin evals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin reads", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getAuthSession).mockResolvedValue(null);
    const route = await import("@/app/api/admin/evals/route");

    const response = await route.GET(new Request("https://example.com/api/admin/evals"));

    expect(response.status).toBe(401);
  });

  it("returns datasets and runs for admins", async () => {
    const auth = await import("@/lib/auth");
    const evals = await import("@/lib/ai-evals");
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
    vi.mocked(evals.listEvalDatasets).mockResolvedValue([]);
    vi.mocked(evals.listEvalRuns).mockResolvedValue([]);
    const route = await import("@/app/api/admin/evals/route");

    const response = await route.GET(new Request("https://example.com/api/admin/evals"));

    await expect(response.json()).resolves.toEqual({ datasets: [], runs: [], comparison: null });
  });

  it("creates datasets for admins", async () => {
    const auth = await import("@/lib/auth");
    const evals = await import("@/lib/ai-evals");
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
    vi.mocked(evals.createEvalDataset).mockResolvedValue({
      id: "dataset-1",
      name: "Custom",
      description: "Custom dataset",
      workflow: "copilot_answers",
      criticalThreshold: 0.8,
      createdAt: "now",
      updatedAt: "now",
      cases: [],
    });
    const route = await import("@/app/api/admin/evals/route");

    const response = await route.POST(
      new Request("https://example.com/api/admin/evals", {
        method: "POST",
        body: JSON.stringify({ action: "create_dataset", name: "Custom", cases: [{}] }),
      })
    );

    expect(response.status).toBe(201);
  });
});
