import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { opportunities } from "@/lib/opportunities";

const TEST_DB_PATH = `${process.cwd()}/.data/test-opportunity-graph.db`;

describe("opportunity graph context", () => {
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

  it("builds evidence-backed graph context for an opportunity", async () => {
    const { buildOpportunityGraphContext } = await import("@/lib/opportunity-graph");
    const opportunity = opportunities[0];

    if (!opportunity) {
      throw new Error("Expected at least one seeded opportunity.");
    }

    const graph = await buildOpportunityGraphContext(opportunity);
    const entityTypes = new Set(graph.entities.map((entity) => entity.entityType));
    const relationshipTypes = new Set(
      graph.relationships.map((relationship) => relationship.relationshipType)
    );

    expect(graph.opportunityEntity.entityType).toBe("opportunity");
    expect(entityTypes.has("permit")).toBe(true);
    expect(entityTypes.has("parcel")).toBe(true);
    expect(entityTypes.has("property")).toBe(true);
    expect(relationshipTypes.has("has_permit")).toBe(true);
    expect(relationshipTypes.has("located_on")).toBe(true);
    expect(graph.relationships.every((relationship) => relationship.evidence.length > 0)).toBe(
      true
    );
  });

  it("projects imported permit parties into evidence-backed relationships", async () => {
    const { buildOpportunityGraphContext } = await import("@/lib/opportunity-graph");
    const seeded = opportunities[0];

    if (!seeded?.signals[0]) {
      throw new Error("Expected a seeded opportunity signal.");
    }

    const opportunity = structuredClone(seeded);
    opportunity.signals = [
      {
        ...opportunity.signals[0],
        id: "imported-mesa-record-1001",
        approvalStage: "pre_approval",
        applicantName: "Permit Services LLC",
        developerName: "Retail Growth Partners LLC",
        ownerName: "Main Street Owner LLC",
        contractorName: "Desert Build Co",
        architectName: "Studio Retail Architects",
        engineerName: "Southwest Civil Engineering",
      },
    ];

    const graph = await buildOpportunityGraphContext(opportunity);
    const entityTypes = new Set(graph.entities.map((entity) => entity.entityType));
    const relationshipTypes = new Set(
      graph.relationships.map((relationship) => relationship.relationshipType)
    );

    for (const entityType of [
      "developer",
      "owner",
      "general_contractor",
      "architect",
      "engineer",
    ]) {
      expect(entityTypes.has(entityType as never)).toBe(true);
    }
    for (const relationshipType of [
      "applicant_for",
      "owns",
      "contractor_on",
      "architect_on",
      "engineer_on",
    ]) {
      expect(relationshipTypes.has(relationshipType as never)).toBe(true);
    }
    expect(graph.relationships.every((relationship) => relationship.lastVerifiedAt)).toBe(true);
    expect(graph.relationships.every((relationship) => relationship.evidence.length > 0)).toBe(
      true
    );
  });
});
