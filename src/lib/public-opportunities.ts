import type { Opportunity } from "@/types/domain";
import type { OpportunityGraphContext } from "@/types/graph";
import { PublicApiHttpError } from "@/lib/public-api-http";

function integerParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const value = params.get(name);
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new PublicApiHttpError(400, `${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

export function queryPublicOpportunities(opportunities: Opportunity[], params: URLSearchParams) {
  const limit = integerParam(params, "limit", 25, 1, 100);
  const offset = integerParam(params, "cursor", 0, 0, Number.MAX_SAFE_INTEGER);
  const minScore = integerParam(params, "minScore", 0, 0, 100);
  const marketId = params.get("marketId");
  const type = params.get("opportunityType");
  if (type && !["development", "value_add", "distress", "leasing", "repositioning"].includes(type)) {
    throw new PublicApiHttpError(400, "Unknown opportunityType.");
  }
  const filtered = opportunities
    .filter((item) => (!marketId || item.marketId === marketId) && (!type || item.opportunityType === type) && item.priorityScore >= minScore)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id));
  const page = filtered.slice(offset, offset + limit);
  return {
    data: page.map(serializePublicOpportunity),
    pagination: {
      limit,
      nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : null,
      totalReturned: page.length,
    },
    meta: { totalAvailable: filtered.length },
  };
}

export function serializePublicOpportunity(item: Opportunity) {
  return {
    id: item.id,
    slug: item.slug,
    marketId: item.marketId,
    title: item.title,
    projectName: item.projectName ?? null,
    locationLabel: item.locationLabel,
    opportunityType: item.opportunityType,
    developmentStage: item.developmentStage,
    priorityScore: item.priorityScore,
    priorityBand: item.priorityBand,
    confidenceLevel: item.confidenceLevel,
    whyItMatters: item.whyItMatters,
    nextStep: item.nextStep,
    missingFacts: item.missingFacts,
    tags: item.tags,
    evidence: item.evidence,
    signals: item.signals,
    parcelContext: item.parcelContext,
    scoreBreakdown: item.scoreBreakdown,
    metadata: item.metadata,
  };
}

export function serializePublicGraph(graph: OpportunityGraphContext) {
  // Arbitrary graph properties and provenance can grow to contain private enrichment.
  return {
    opportunityEntityId: graph.opportunityEntity.id,
    entities: graph.entities.map((entity) => ({
      id: entity.id,
      entityType: entity.entityType,
      displayName: entity.displayName,
      sourceSystem: entity.sourceSystem,
      sourceId: entity.sourceId,
      confidence: entity.confidence,
      createdAt: entity.createdAt,
      lastVerifiedAt: entity.lastVerifiedAt,
    })),
    relationships: graph.relationships.map((relationship) => ({
      id: relationship.id,
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      relationshipType: relationship.relationshipType,
      confidence: relationship.confidence,
      sourceSystem: relationship.sourceSystem,
      sourceId: relationship.sourceId,
      createdAt: relationship.createdAt,
      lastVerifiedAt: relationship.lastVerifiedAt,
      evidence: relationship.evidence,
    })),
  };
}
