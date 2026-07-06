import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/domain-events", () => ({
  dispatchPendingDomainEvents: vi.fn(),
  getEventDashboard: vi.fn(),
}));

describe("admin events API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated reads", async () => {
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getAuthSession).mockResolvedValue(null);
    const route = await import("@/app/api/admin/events/route");

    const response = await route.GET();

    expect(response.status).toBe(401);
  });

  it("returns event dashboard data for admins", async () => {
    const auth = await import("@/lib/auth");
    const events = await import("@/lib/domain-events");
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
    vi.mocked(events.getEventDashboard).mockResolvedValue({
      pending: 0,
      published: 0,
      failed: 0,
      recentEvents: [],
      subscriptions: [],
    });
    const route = await import("@/app/api/admin/events/route");

    const response = await route.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      dashboard: {
        pending: 0,
        published: 0,
        failed: 0,
        recentEvents: [],
        subscriptions: [],
      },
    });
  });

  it("dispatches pending events for admins", async () => {
    const auth = await import("@/lib/auth");
    const events = await import("@/lib/domain-events");
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
    vi.mocked(events.dispatchPendingDomainEvents).mockResolvedValue({
      scanned: 2,
      published: 2,
      failed: 0,
    });
    const route = await import("@/app/api/admin/events/route");

    const response = await route.POST(
      new Request("https://example.com/api/admin/events", {
        method: "POST",
        body: JSON.stringify({ action: "dispatch_pending", limit: 2 }),
      })
    );

    expect(response.status).toBe(200);
    expect(events.dispatchPendingDomainEvents).toHaveBeenCalledWith(2);
  });
});
