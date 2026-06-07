import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-ingest-eldorado.db`;

describe("El Dorado ingestion", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
  });

  afterEach(async () => {
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  it("loads normalized El Dorado permit signals into the ingestion tables", async () => {
    const ingestion = await import("@/lib/ingest-eldorado");
    const store = await import("@/lib/ingestion-store");

    const firstRun = await ingestion.ingestElDoradoPermitSignals();
    const secondRun = await ingestion.ingestElDoradoPermitSignals();
    const health = await store.listDataHealthByMarket();

    expect(firstRun.recordsFound).toBeGreaterThan(0);
    expect(firstRun.recordsInserted).toBe(firstRun.recordsFound);
    expect(firstRun.recordsUpdated).toBe(0);
    expect(secondRun.recordsFound).toBe(firstRun.recordsFound);
    expect(secondRun.recordsInserted).toBe(0);
    expect(secondRun.recordsUpdated).toBe(firstRun.recordsFound);
    expect(health[0]?.permit_records).toBe(firstRun.recordsFound);
    expect(health[0]?.latest_run_status).toBe("succeeded");
  });
});
