import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-generated-opportunity-sources.db`;

describe("generated opportunity sources", () => {
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

  it("turns stored permit records into sourced opportunity batches", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-1",
      marketId: "ca-san-diego-development",
      sourceName: "City of San Diego Open Data",
      sourceUrl: "https://data.sandiego.gov/datasets/development-permits/",
      documentUrl:
        "https://seshat.datasd.org/development_permits/approvals_issued_2026_datasd.csv",
      reportLabel: "City of San Diego approvals for development projects, 2026",
      reportingPeriodStart: "2026-01-01",
      reportingPeriodEnd: "2026-06-08",
      publishedAt: "2026-06-08",
      accessedAt: "2026-06-09T12:00:00.000Z",
    });

    await ingestion.upsertPermitRecord({
      id: "generated-permit-record-1",
      sourceDocumentId,
      marketId: "ca-san-diego-development",
      jurisdiction: "City of San Diego",
      permitNumber: "PRJ-11001",
      permitType: "PLANNED DEVELOPMENT",
      permitSubtype: "Site Development Permit",
      status: "Approved",
      appliedDate: "2026-04-01",
      issuedDate: "2026-06-07",
      address: "500 Harbor Drive",
      city: "San Diego",
      parcelNumber: "535-000-010",
      applicant: "Harbor Growth Partners",
      valuation: 2500000,
      description: "Planned development approval for mixed-use infill project.",
      raw: { PROJECT_TITLE: "Harbor Drive mixed-use infill" },
      contentHash: "sha256:generated-permit-record-1",
    });

    const batches = await generator.buildGeneratedOpportunitySourceBatches();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.market.id).toBe("ca-san-diego-development");
    expect(batches[0]?.signals[0]?.projectName).toBe("Harbor Drive mixed-use infill");
    expect(batches[0]?.signals[0]?.source.pageUrl).toBe(
      "https://data.sandiego.gov/datasets/development-permits/"
    );
    expect(batches[0]?.seeds[0]?.opportunityHint).toBe("development");
    expect(batches[0]?.seeds[0]?.projectScale).toBe("large");
    expect(batches[0]?.seeds[0]?.missingFacts).toContain(
      "Current owner and site-control status"
    );
    expect(batches[0]?.seeds[0]?.tags).toContain("Generated from stored ingestion");
  });
});
