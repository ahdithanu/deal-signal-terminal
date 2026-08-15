import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NationwideIngestionBatch } from "@/types/ingestion-bridge";

const TEST_DB_PATH = `${process.cwd()}/.data/test-ingestion-bridge.db`;

function testBatch(): NationwideIngestionBatch {
  return {
    version: "1.0",
    batchId: "mesa-2026-08-15T2200Z",
    generatedAt: "2026-08-15T22:00:00Z",
    source: {
      key: "mesa_az_commercial_permit_submittals",
      name: "Mesa Commercial Permit Submittals",
      jurisdiction: "Mesa, Arizona",
      sourceUrl: "https://data.mesaaz.gov/permits",
    },
    records: [
      {
        externalRecordId: "record-1001",
        marketId: "az-mesa",
        jurisdiction: "City of Mesa",
        approvalStage: "pre_approval",
        applicationNumber: "PMT25-1001",
        permitType: "COMMERCIAL BUILDING",
        permitSubtype: "Tenant Improvement",
        status: "Plan Review",
        description: "Tenant improvement for a Dutch Bros coffee shop.",
        projectName: "Dutch Bros - East Main Street",
        location: {
          address: "1234 E Main St",
          city: "Mesa",
          state: "AZ",
          parcelId: "140-01-001",
          latitude: 33.415,
          longitude: -111.8,
        },
        parties: {
          applicant: "Permit Services LLC",
          owner: "Main Street Owner LLC",
          developer: "Retail Growth Partners LLC",
          contractor: "Desert Build Co",
          architect: "Studio Retail Architects",
          engineer: "Southwest Civil Engineering",
        },
        dates: {
          filedAt: "2026-08-10",
          statusUpdatedAt: "2026-08-14",
        },
        evidence: {
          recordUrl: "https://data.mesaaz.gov/permits/record-1001",
          pageUrl: "https://data.mesaaz.gov/permits",
          excerpt: "Plan review application names Dutch Bros as the tenant.",
          publishedAt: "2026-08-14",
          accessedAt: "2026-08-15T21:55:00Z",
        },
        confidence: 0.93,
        attributes: { valuation: 650000 },
      },
    ],
  };
}

describe("nationwide ingestion bridge", () => {
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
    delete process.env.INGESTION_BRIDGE_SECRET;
  });

  it("rejects unsupported versions and invalid confidence", async () => {
    const { parseNationwideIngestionBatch } = await import("@/lib/ingestion-bridge");

    expect(() => parseNationwideIngestionBatch({ ...testBatch(), version: "2.0" })).toThrow(
      "Unsupported contract version"
    );
    expect(() =>
      parseNationwideIngestionBatch({
        ...testBatch(),
        records: [{ ...testBatch().records[0], confidence: 1.2 }],
      })
    ).toThrow("confidence must be between 0 and 1");
    expect(() =>
      parseNationwideIngestionBatch({
        ...testBatch(),
        records: [
          testBatch().records[0],
          { ...testBatch().records[0], externalRecordId: "record-2", marketId: "az-tempe" },
        ],
      })
    ).toThrow("must share the same marketId");
  });

  it("imports pre-approval records idempotently and preserves graph-ready parties and evidence", async () => {
    const bridge = await import("@/lib/ingestion-bridge");
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const batch = bridge.parseNationwideIngestionBatch(testBatch());

    const first = await bridge.importNationwideIngestionBatch(batch);
    const second = await bridge.importNationwideIngestionBatch(batch);
    const records = await ingestion.listRecentPermitRecords();
    const generated = await generator.buildGeneratedOpportunitySourceBatches();
    const signal = generated[0]?.signals[0];

    expect(first.recordsInserted).toBe(1);
    expect(first.recordsUpdated).toBe(0);
    expect(second.recordsInserted).toBe(0);
    expect(second.recordsUpdated).toBe(1);
    expect(records).toHaveLength(1);
    expect(signal?.permitNumber).toBe("PMT25-1001");
    expect(signal?.approvalStage).toBe("pre_approval");
    expect(signal?.developerName).toBe("Retail Growth Partners LLC");
    expect(signal?.ownerName).toBe("Main Street Owner LLC");
    expect(signal?.architectName).toBe("Studio Retail Architects");
    expect(signal?.engineerName).toBe("Southwest Civil Engineering");
    expect(signal?.source.url).toBe("https://data.mesaaz.gov/permits/record-1001");
    expect(generated[0]?.seeds[0]?.developmentStage).toBe("early_signal");
  });
});
