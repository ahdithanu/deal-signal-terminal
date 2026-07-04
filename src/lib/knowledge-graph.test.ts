import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_DB_PATH = `${process.cwd()}/.data/test-knowledge-graph.db`;

describe("knowledge graph", () => {
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

  it("creates and deduplicates entities using normalized aliases", async () => {
    const graph = await import("@/lib/knowledge-graph");
    const first = await graph.upsertGraphEntity({
      entityType: "developer",
      displayName: "Acme Development LLC",
      aliases: [{ alias: "Acme Development", aliasType: "name", confidence: 0.91 }],
      sourceSystem: "test",
      sourceId: "developer-acme",
      confidence: 0.9,
    });
    const second = await graph.upsertGraphEntity({
      entityType: "developer",
      displayName: "ACME Development",
      aliases: [{ alias: "Acme Development LLC", aliasType: "name", confidence: 0.9 }],
      confidence: 0.88,
    });
    const detail = await graph.getGraphEntityDetail(first.id);

    expect(second.id).toBe(first.id);
    expect(detail?.aliases.some((alias) => alias.normalizedAlias === "acme development")).toBe(
      true
    );
  });

  it("stores relationship evidence, confidence, and verification timestamps", async () => {
    const graph = await import("@/lib/knowledge-graph");
    const owner = await graph.upsertGraphEntity({
      entityType: "owner",
      displayName: "Harbor Owner LLC",
    });
    const parcel = await graph.upsertGraphEntity({
      entityType: "parcel",
      displayName: "APN 535-000-010",
      aliases: [{ alias: "535-000-010", aliasType: "parcel_number", confidence: 0.99 }],
    });
    const relationship = await graph.upsertGraphRelationship({
      fromEntityId: owner.id,
      toEntityId: parcel.id,
      relationshipType: "owns",
      confidence: 0.83,
      sourceSystem: "parcel-context",
      sourceId: "owner-parcel-1",
      provenance: { importRunId: "run-1" },
      lastVerifiedAt: "2026-06-09",
      evidence: [
        {
          evidenceKey: "evidence-1",
          label: "County parcel extract",
          reportLabel: "Parcel context extract",
          url: "https://example.com/parcel.csv",
          pageUrl: "https://example.com",
          recordId: "535-000-010",
          publishedAt: "2026-06-08",
          accessedAt: "2026-06-09",
          excerpt: "Owner listed as Harbor Owner LLC.",
        },
      ],
    });

    expect(relationship.confidence).toBe(0.83);
    expect(relationship.lastVerifiedAt).toBe("2026-06-09");
    expect(relationship.provenance.importRunId).toBe("run-1");
    expect(relationship.evidence[0]?.recordId).toBe("535-000-010");
  });

  it("queries related entities and relationship paths", async () => {
    const graph = await import("@/lib/knowledge-graph");
    const opportunity = await graph.upsertGraphEntity({
      entityType: "opportunity",
      displayName: "Harbor opportunity",
    });
    const permit = await graph.upsertGraphEntity({
      entityType: "permit",
      displayName: "PRJ-1 Site Development",
    });
    const parcel = await graph.upsertGraphEntity({
      entityType: "parcel",
      displayName: "APN 535-000-010",
    });

    await graph.upsertGraphRelationship({
      fromEntityId: opportunity.id,
      toEntityId: permit.id,
      relationshipType: "has_permit",
      sourceSystem: "test",
      sourceId: "opportunity-permit",
      evidence: [
        {
          evidenceKey: "opportunity-permit",
          label: "Permit row",
          reportLabel: "Permit report",
          accessedAt: "2026-06-09",
          excerpt: "Permit linked to opportunity.",
        },
      ],
    });
    await graph.upsertGraphRelationship({
      fromEntityId: permit.id,
      toEntityId: parcel.id,
      relationshipType: "located_on",
      sourceSystem: "test",
      sourceId: "permit-parcel",
      evidence: [
        {
          evidenceKey: "permit-parcel",
          label: "Permit row",
          reportLabel: "Permit report",
          accessedAt: "2026-06-09",
          excerpt: "Permit lists parcel.",
        },
      ],
    });

    const related = await graph.listRelatedEntities(opportunity.id);
    const paths = await graph.findRelationshipPaths(opportunity.id, parcel.id);

    expect(related.map((entry) => entry.entity.id)).toContain(permit.id);
    expect(paths[0]?.entities.map((entity) => entity.id)).toEqual([
      opportunity.id,
      permit.id,
      parcel.id,
    ]);
  });
});
