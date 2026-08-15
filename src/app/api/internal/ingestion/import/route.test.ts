import { beforeEach, describe, expect, it, vi } from "vitest";

const importNationwideIngestionBatch = vi.fn();
const parseNationwideIngestionBatch = vi.fn();

vi.mock("@/lib/ingestion-bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ingestion-bridge")>();
  return {
    ...actual,
    importNationwideIngestionBatch,
    parseNationwideIngestionBatch,
  };
});

describe("POST /api/internal/ingestion/import", () => {
  beforeEach(() => {
    importNationwideIngestionBatch.mockReset();
    parseNationwideIngestionBatch.mockReset();
    process.env.INGESTION_BRIDGE_SECRET = "test-bridge-secret";
  });

  it("rejects requests without the bridge bearer secret", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://example.com/api/internal/ingestion/import", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
    expect(importNationwideIngestionBatch).not.toHaveBeenCalled();
  });

  it("imports a valid authenticated batch", async () => {
    const parsedBatch = { batchId: "batch-1" };
    parseNationwideIngestionBatch.mockReturnValue(parsedBatch);
    importNationwideIngestionBatch.mockResolvedValue({
      batchId: "batch-1",
      runId: "run-1",
      sourceKey: "source-1",
      recordsFound: 1,
      recordsInserted: 1,
      recordsUpdated: 0,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://example.com/api/internal/ingestion/import", {
        method: "POST",
        headers: { authorization: "Bearer test-bridge-secret" },
        body: JSON.stringify({ version: "1.0" }),
      })
    );

    expect(response.status).toBe(200);
    expect(parseNationwideIngestionBatch).toHaveBeenCalledWith({ version: "1.0" });
    expect(importNationwideIngestionBatch).toHaveBeenCalledWith(parsedBatch);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { batchId: "batch-1", recordsInserted: 1 },
    });
  });
});
