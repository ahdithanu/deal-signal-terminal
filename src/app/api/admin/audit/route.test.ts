import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthSession = vi.fn();
const listRecentAuditEvents = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/audit", () => ({
  listRecentAuditEvents,
}));

describe("GET /api/admin/audit", () => {
  beforeEach(() => {
    getAuthSession.mockReset();
    listRecentAuditEvents.mockReset();
  });

  it("returns 401 when no authenticated session is present", async () => {
    getAuthSession.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("returns 403 for non-admin users", async () => {
    getAuthSession.mockResolvedValue({
      role: "member",
      userId: "user-1",
      orgId: "org-1",
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Admin access required." });
  });

  it("returns parsed audit events for admins", async () => {
    getAuthSession.mockResolvedValue({
      role: "admin",
      userId: "user-1",
      orgId: "org-1",
    });
    listRecentAuditEvents.mockReturnValue([
      {
        id: "evt-1",
        occurred_at: "2026-04-18T18:30:00.000Z",
        org_id: "org-1",
        user_id: "user-1",
        action: "watchlist.add",
        resource_type: "opportunity",
        resource_id: "opp-1",
        metadata_json: JSON.stringify({ source: "watchlist" }),
      },
    ]);
    const { GET } = await import("./route");

    const response = await GET();

    expect(listRecentAuditEvents).toHaveBeenCalledWith({ orgId: "org-1" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          id: "evt-1",
          occurredAt: "2026-04-18T18:30:00.000Z",
          orgId: "org-1",
          userId: "user-1",
          action: "watchlist.add",
          resourceType: "opportunity",
          resourceId: "opp-1",
          metadata: { source: "watchlist" },
        },
      ],
    });
  });
});
