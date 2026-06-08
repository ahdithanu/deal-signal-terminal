import { beforeEach, describe, expect, it, vi } from "vitest";

const runAllIngestions = vi.fn();

vi.mock("@/lib/ingestion-runner", () => ({
  runAllIngestions,
}));

describe("GET /api/cron/ingest/all", () => {
  beforeEach(() => {
    runAllIngestions.mockReset();
    delete process.env.CRON_SECRET;
    delete process.env.BUILD_SIGNALS_CRON_SECRET;
  });

  it("rejects requests without a cron bearer secret", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("https://example.com/api/cron/ingest/all"));

    expect(response.status).toBe(401);
    expect(runAllIngestions).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("runs all market ingestions for authorized cron requests", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    runAllIngestions.mockResolvedValue({
      markets: [
        { marketId: "ca-eldorado-west-slope", recordsFound: 16, recordsInserted: 0, recordsUpdated: 16 },
        { marketId: "ca-san-diego-development", recordsFound: 50, recordsInserted: 50, recordsUpdated: 0 },
      ],
      recordsFound: 66,
      recordsInserted: 50,
      recordsUpdated: 16,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/ingest/all", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(runAllIngestions).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        markets: [
          { marketId: "ca-eldorado-west-slope", recordsFound: 16, recordsInserted: 0, recordsUpdated: 16 },
          { marketId: "ca-san-diego-development", recordsFound: 50, recordsInserted: 50, recordsUpdated: 0 },
        ],
        recordsFound: 66,
        recordsInserted: 50,
        recordsUpdated: 16,
      },
    });
  });
});
