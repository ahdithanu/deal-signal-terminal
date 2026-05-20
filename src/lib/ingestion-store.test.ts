import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-ingestion-store.db`;

describe("ingestion store", () => {
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

  it("stores source documents, permit records, and ingestion run health", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "source-doc-1",
      marketId: "ca-eldorado-west-slope",
      sourceName: "El Dorado County Building Division",
      sourceUrl:
        "https://www.eldoradocounty.ca.gov/Land-Use/Planning-and-Building/Building-Division/Permit-Activity-Reports",
      documentUrl:
        "https://www.eldoradocounty.ca.gov/files/assets/county/v/1/documents/land-use/permit-activity-reports/2026/3.16-to-3.22.xlsx",
      reportLabel: "El Dorado County permit activity report, March 16-22, 2026",
      reportingPeriodStart: "2026-03-16",
      reportingPeriodEnd: "2026-03-22",
      publishedAt: "2026-03-24",
      accessedAt: "2026-05-19T12:00:00.000Z",
      checksum: "sha256:test",
      metadata: { sourceType: "permit_activity_report" },
    });
    const runId = await ingestion.startIngestionRun({
      id: "run-1",
      sourceDocumentId,
      marketId: "ca-eldorado-west-slope",
      startedAt: "2026-05-19T12:01:00.000Z",
    });

    await ingestion.upsertPermitRecord({
      id: "permit-record-1",
      sourceDocumentId,
      marketId: "ca-eldorado-west-slope",
      jurisdiction: "El Dorado County",
      permitNumber: "0390823",
      permitType: "COMMERCIAL",
      permitSubtype: "CONSTRUCTION TRAILER/OFFICE",
      status: "APPLIED",
      appliedDate: "2026-03-18",
      address: "Quantum Care",
      city: "Placerville",
      parcelNumber: "000-000-001",
      valuation: 12000,
      description: "Temporary sales office trailer",
      raw: { permitNumber: "0390823" },
      contentHash: "sha256:permit",
    });
    await ingestion.finishIngestionRun({
      id: runId,
      status: "succeeded",
      finishedAt: "2026-05-19T12:02:00.000Z",
      recordsFound: 1,
      recordsInserted: 1,
      recordsUpdated: 0,
    });

    const markets = await ingestion.listDataHealthByMarket();

    expect(markets).toHaveLength(1);
    expect(markets[0]?.market_id).toBe("ca-eldorado-west-slope");
    expect(markets[0]?.source_documents).toBe(1);
    expect(markets[0]?.permit_records).toBe(1);
    expect(markets[0]?.latest_run_status).toBe("succeeded");
    expect(markets[0]?.latest_run_records_found).toBe(1);
  });
});
