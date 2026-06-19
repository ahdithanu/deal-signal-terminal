import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthSession = vi.fn();
const listDataHealthByMarket = vi.fn();
const listGeneratedOpportunityHealth = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/ingestion-store", () => ({
  listDataHealthByMarket,
}));

vi.mock("@/lib/opportunity-service", () => ({
  listGeneratedOpportunityHealth,
}));

describe("GET /api/admin/data-health", () => {
  beforeEach(() => {
    getAuthSession.mockReset();
    listDataHealthByMarket.mockReset();
    listGeneratedOpportunityHealth.mockReset();
  });

  it("returns 401 when the session is not admin", async () => {
    getAuthSession.mockResolvedValue({
      role: "member",
      userId: "user-1",
      orgId: "org-1",
    });
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(listDataHealthByMarket).not.toHaveBeenCalled();
    expect(listGeneratedOpportunityHealth).not.toHaveBeenCalled();
  });

  it("returns storage health and generated opportunity conversion health for admins", async () => {
    getAuthSession.mockResolvedValue({
      role: "admin",
      userId: "user-1",
      orgId: "org-1",
    });
    listDataHealthByMarket.mockResolvedValue([
      {
        market_id: "ca-san-diego-development",
        source_documents: 1,
        permit_records: 50,
      },
    ]);
    listGeneratedOpportunityHealth.mockResolvedValue([
      {
        marketId: "ca-san-diego-development",
        generatedSignals: 50,
        generatedSeeds: 50,
        generatedOpportunities: 42,
        surfacedOpportunities: 12,
        topOpportunity: {
          slug: "generated-ca-san-diego-development-prj-1",
          title: "Harbor Drive mixed-use infill",
          priorityScore: 89,
          priorityBand: "critical",
        },
      },
    ]);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      markets: [
        {
          market_id: "ca-san-diego-development",
          source_documents: 1,
          permit_records: 50,
        },
      ],
      generatedOpportunityHealth: [
        {
          marketId: "ca-san-diego-development",
          generatedSignals: 50,
          generatedSeeds: 50,
          generatedOpportunities: 42,
          surfacedOpportunities: 12,
          topOpportunity: {
            slug: "generated-ca-san-diego-development-prj-1",
            title: "Harbor Drive mixed-use infill",
            priorityScore: 89,
            priorityBand: "critical",
          },
        },
      ],
    });
  });
});
