import { beforeEach, describe, expect, it, vi } from "vitest";

const runElDoradoIngestion = vi.fn();

vi.mock("@/lib/ingestion-runner", () => ({
  runElDoradoIngestion,
}));

describe("GET /api/cron/ingest/eldorado", () => {
  beforeEach(() => {
    runElDoradoIngestion.mockReset();
    delete process.env.CRON_SECRET;
    delete process.env.BUILD_SIGNALS_CRON_SECRET;
  });

  it("rejects requests without Vercel cron identity or bearer secret", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("https://example.com/api/cron/ingest/eldorado"));

    expect(response.status).toBe(401);
    expect(runElDoradoIngestion).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("runs ingestion for Vercel cron requests signed with CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    runElDoradoIngestion.mockResolvedValue({
      runId: "run-1",
      marketId: "ca-eldorado-west-slope",
      recordsFound: 16,
      recordsInserted: 0,
      recordsUpdated: 16,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/ingest/eldorado", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(runElDoradoIngestion).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        runId: "run-1",
        marketId: "ca-eldorado-west-slope",
        recordsFound: 16,
        recordsInserted: 0,
        recordsUpdated: 16,
      },
    });
  });

  it("supports the Build Signals namespaced cron secret", async () => {
    process.env.BUILD_SIGNALS_CRON_SECRET = "namespaced-cron-secret";
    runElDoradoIngestion.mockResolvedValue({
      runId: "run-2",
      marketId: "ca-eldorado-west-slope",
      recordsFound: 16,
      recordsInserted: 0,
      recordsUpdated: 16,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/ingest/eldorado", {
        headers: {
          authorization: "Bearer namespaced-cron-secret",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(runElDoradoIngestion).toHaveBeenCalledOnce();
  });
});
