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

  it("clusters related permit records into one project-level opportunity", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-2",
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
      id: "generated-permit-record-2a",
      sourceDocumentId,
      marketId: "ca-san-diego-development",
      jurisdiction: "City of San Diego",
      permitNumber: "PRJ-22001",
      permitType: "SITE DEVELOPMENT",
      permitSubtype: "Grading Permit",
      status: "Issued",
      appliedDate: "2026-05-01",
      issuedDate: "2026-06-04",
      address: "750 Market Street",
      city: "San Diego",
      parcelNumber: "535-000-020",
      applicant: "Market Street Owner LLC",
      valuation: 1200000,
      description: "Site development and grading for downtown mixed-use project.",
      raw: { PROJECT_TITLE: "Market Street mixed-use" },
      contentHash: "sha256:generated-permit-record-2a",
    });
    await ingestion.upsertPermitRecord({
      id: "generated-permit-record-2b",
      sourceDocumentId,
      marketId: "ca-san-diego-development",
      jurisdiction: "City of San Diego",
      permitNumber: "PRJ-22002",
      permitType: "BUILDING PERMIT",
      permitSubtype: "Shell Building",
      status: "Issued",
      appliedDate: "2026-05-02",
      issuedDate: "2026-06-06",
      address: "750 Market St Suite 100",
      city: "San Diego",
      parcelNumber: "535-000-020",
      applicant: "Market Street Owner LLC",
      valuation: 3500000,
      description: "Building permit for mixed-use shell construction.",
      raw: { PROJECT_TITLE: "Market Street mixed-use" },
      contentHash: "sha256:generated-permit-record-2b",
    });

    const batches = await generator.buildGeneratedOpportunitySourceBatches();
    const seed = batches[0]?.seeds[0];

    expect(batches).toHaveLength(1);
    expect(batches[0]?.signals).toHaveLength(2);
    expect(batches[0]?.seeds).toHaveLength(1);
    expect(seed?.signalIds).toHaveLength(2);
    expect(seed?.thesis).toContain("2 sourced public permit records");
    expect(seed?.whyItMatters).toContain("site development");
    expect(seed?.whyItMatters).toContain("building permit");
  });

  it("clusters same-parcel records even when city values differ", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-4",
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

    for (const city of ["San Diego", null]) {
      const index = city ? "a" : "b";
      await ingestion.upsertPermitRecord({
        id: `generated-permit-record-4${index}`,
        sourceDocumentId,
        marketId: "ca-san-diego-development",
        jurisdiction: "City of San Diego",
        permitNumber: `PRJ-4400${index}`,
        permitType: "BUILDING PERMIT",
        permitSubtype: "Stored permit record",
        status: "Issued",
        appliedDate: "2026-05-01",
        issuedDate: "2026-06-01",
        address: null,
        city,
        parcelNumber: "535-000-040",
        applicant: null,
        valuation: 500000,
        description: "Same parcel building permit.",
        raw: {},
        contentHash: `sha256:generated-permit-record-4${index}`,
      });
    }

    const batches = await generator.buildGeneratedOpportunitySourceBatches();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.signals).toHaveLength(2);
    expect(batches[0]?.seeds).toHaveLength(1);
  });

  it("clusters address-only records after street suffix normalization", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-5",
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

    for (const [index, address] of [
      ["a", "750 Market Street"],
      ["b", "750 Market St Suite 100"],
    ] as const) {
      await ingestion.upsertPermitRecord({
        id: `generated-permit-record-5${index}`,
        sourceDocumentId,
        marketId: "ca-san-diego-development",
        jurisdiction: "City of San Diego",
        permitNumber: `PRJ-5500${index}`,
        permitType: "BUILDING PERMIT",
        permitSubtype: "Stored permit record",
        status: "Issued",
        appliedDate: "2026-05-01",
        issuedDate: "2026-06-01",
        address,
        city: "San Diego",
        parcelNumber: null,
        applicant: null,
        valuation: 500000,
        description: "Address-only building permit.",
        raw: {},
        contentHash: `sha256:generated-permit-record-5${index}`,
      });
    }

    const batches = await generator.buildGeneratedOpportunitySourceBatches();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.signals).toHaveLength(2);
    expect(batches[0]?.seeds).toHaveLength(1);
  });

  it("keeps records separate when no reliable project identifier is present", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-3",
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

    for (const index of [1, 2]) {
      await ingestion.upsertPermitRecord({
        id: `generated-permit-record-3${index}`,
        sourceDocumentId,
        marketId: "ca-san-diego-development",
        jurisdiction: "City of San Diego",
        permitNumber: `PRJ-3300${index}`,
        permitType: "BUILDING PERMIT",
        permitSubtype: "Stored permit record",
        status: "Issued",
        appliedDate: "2026-05-01",
        issuedDate: `2026-06-0${index}`,
        address: null,
        city: "San Diego",
        parcelNumber: null,
        applicant: null,
        valuation: 100000,
        description: `Generic building permit ${index}.`,
        raw: { PROJECT_TITLE: "Project" },
        contentHash: `sha256:generated-permit-record-3${index}`,
      });
    }

    const batches = await generator.buildGeneratedOpportunitySourceBatches();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.signals).toHaveLength(2);
    expect(batches[0]?.seeds).toHaveLength(2);
  });

  it("does not merge unrelated records with generic project titles", async () => {
    const ingestion = await import("@/lib/ingestion-store");
    const generator = await import("@/lib/generated-opportunity-sources");
    const sourceDocumentId = await ingestion.upsertSourceDocument({
      id: "generated-source-doc-6",
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

    for (const [index, address, parcelNumber] of [
      ["a", "100 First Avenue", "535-000-060"],
      ["b", "200 Second Avenue", "535-000-061"],
    ] as const) {
      await ingestion.upsertPermitRecord({
        id: `generated-permit-record-6${index}`,
        sourceDocumentId,
        marketId: "ca-san-diego-development",
        jurisdiction: "City of San Diego",
        permitNumber: `PRJ-6600${index}`,
        permitType: "BUILDING PERMIT",
        permitSubtype: "Tenant Improvement",
        status: "Issued",
        appliedDate: "2026-05-01",
        issuedDate: "2026-06-01",
        address,
        city: "San Diego",
        parcelNumber,
        applicant: null,
        valuation: 500000,
        description: "Tenant improvement permit.",
        raw: { PROJECT_TITLE: "Tenant Improvement" },
        contentHash: `sha256:generated-permit-record-6${index}`,
      });
    }

    const batches = await generator.buildGeneratedOpportunitySourceBatches();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.signals).toHaveLength(2);
    expect(batches[0]?.seeds).toHaveLength(2);
  });
});
