import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/observability-dashboard", () => ({
  getObservabilityDashboard: vi.fn(),
  recordObservabilityIncident: vi.fn(),
}));

describe("admin observability API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin reads", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getAuthSession).mockResolvedValue(null);
    const route = await import("@/app/api/admin/observability/route");

    const response = await route.GET(new Request("https://example.com/api/admin/observability"));

    expect(response.status).toBe(401);
  });

  it("returns dashboard data for admins", async () => {
    const auth = await import("@/lib/auth");
    const observability = await import("@/lib/observability-dashboard");
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
    vi.mocked(observability.getObservabilityDashboard).mockResolvedValue({
      generatedAt: "now",
      status: "healthy",
      database: { provider: "sqlite", runtimeReady: true, postgresUrlConfigured: false },
      metrics: [],
      workflows: [],
      incidents: [],
      timeline: [],
      recommendations: [],
    });
    const route = await import("@/app/api/admin/observability/route");

    const response = await route.GET(
      new Request("https://example.com/api/admin/observability?windowHours=12")
    );

    expect(response.status).toBe(200);
    expect(observability.getObservabilityDashboard).toHaveBeenCalledWith({
      orgId: "org-1",
      windowHours: 12,
    });
    await expect(response.json()).resolves.toEqual({
      dashboard: {
        generatedAt: "now",
        status: "healthy",
        database: { provider: "sqlite", runtimeReady: true, postgresUrlConfigured: false },
        metrics: [],
        workflows: [],
        incidents: [],
        timeline: [],
        recommendations: [],
      },
    });
  });

  it("records incidents for admins", async () => {
    const auth = await import("@/lib/auth");
    const observability = await import("@/lib/observability-dashboard");
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
    vi.mocked(observability.recordObservabilityIncident).mockResolvedValue({
      id: "incident-1",
      orgId: "org-1",
      severity: "warning",
      status: "open",
      title: "Ingestion warning",
      source: "ingestion",
      startedAt: "now",
      resolvedAt: null,
      summary: "One market failed.",
      metadata: {},
      createdAt: "now",
      updatedAt: "now",
    });
    const route = await import("@/app/api/admin/observability/route");

    const response = await route.POST(
      new Request("https://example.com/api/admin/observability", {
        method: "POST",
        body: JSON.stringify({
          action: "record_incident",
          severity: "warning",
          title: "Ingestion warning",
          source: "ingestion",
          summary: "One market failed.",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(observability.recordObservabilityIncident).toHaveBeenCalledWith({
      orgId: "org-1",
      severity: "warning",
      status: "open",
      title: "Ingestion warning",
      source: "ingestion",
      summary: "One market failed.",
      metadata: {},
    });
  });
});
