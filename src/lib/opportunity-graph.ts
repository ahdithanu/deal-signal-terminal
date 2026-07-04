import {
  getGraphEntityDetail,
  listRelatedEntities,
  upsertGraphEntity,
  upsertGraphRelationship,
} from "@/lib/knowledge-graph";
import type { Opportunity, PermitSignal, SourceEvidence } from "@/types/domain";
import type {
  GraphEntity,
  GraphEvidence,
  GraphRelationship,
  OpportunityGraphContext,
} from "@/types/graph";

function evidenceFromSource(source: SourceEvidence): Omit<GraphEvidence, "id" | "createdAt"> {
  return {
    evidenceKey: source.id,
    label: source.label,
    reportLabel: source.reportLabel,
    url: source.url,
    pageUrl: source.pageUrl,
    recordId: source.recordId,
    publishedAt: source.publishedAt,
    accessedAt: source.accessedAt,
    excerpt: source.excerpt,
  };
}

function compactAliases(
  aliases: Array<{
    alias: string | null | undefined;
    aliasType?: "name" | "address" | "parcel_number" | "permit_number" | "source_id";
    confidence?: number;
  }>
) {
  return aliases
    .filter((alias): alias is { alias: string; aliasType?: typeof alias.aliasType; confidence?: number } =>
      Boolean(alias.alias?.trim())
    )
    .map((alias) => ({
      alias: alias.alias,
      aliasType: alias.aliasType,
      confidence: alias.confidence,
    }));
}

function relationshipEvidence(signal: PermitSignal) {
  return [evidenceFromSource(signal.source)];
}

async function upsertCityEntity(signal: PermitSignal) {
  return upsertGraphEntity({
    entityType: "city",
    displayName: signal.siteCity === "UNKNOWN" ? signal.jurisdiction : signal.siteCity,
    sourceSystem: "build-signals-market",
    sourceId: `${signal.marketId}:${signal.siteCity}`,
    aliases: compactAliases([
      { alias: signal.siteCity, aliasType: "name" },
      { alias: signal.jurisdiction, aliasType: "name" },
    ]),
    properties: {
      marketId: signal.marketId,
      jurisdiction: signal.jurisdiction,
    },
    confidence: 0.96,
    lastVerifiedAt: signal.source.accessedAt,
  });
}

async function upsertOpportunityEntity(opportunity: Opportunity) {
  return upsertGraphEntity({
    entityType: "opportunity",
    displayName: opportunity.projectName ?? opportunity.title,
    sourceSystem: "build-signals",
    sourceId: opportunity.id,
    aliases: compactAliases([
      { alias: opportunity.title, aliasType: "name" },
      { alias: opportunity.projectName, aliasType: "name" },
      { alias: opportunity.slug, aliasType: "source_id" },
    ]),
    properties: {
      slug: opportunity.slug,
      marketId: opportunity.marketId,
      priorityScore: opportunity.priorityScore,
      priorityBand: opportunity.priorityBand,
      opportunityType: opportunity.opportunityType,
      developmentStage: opportunity.developmentStage,
      confidenceLevel: opportunity.confidenceLevel,
    },
    confidence: opportunity.confidenceLevel === "high" ? 0.93 : opportunity.confidenceLevel === "medium" ? 0.82 : 0.68,
    lastVerifiedAt: opportunity.evidence[0]?.accessedAt ?? new Date().toISOString(),
  });
}

async function upsertPropertyEntity(opportunity: Opportunity, signal: PermitSignal) {
  return upsertGraphEntity({
    entityType: "property",
    displayName: signal.siteAddress,
    sourceSystem: "build-signals-property",
    sourceId: `${signal.marketId}:${signal.siteAddress}`,
    aliases: compactAliases([{ alias: signal.siteAddress, aliasType: "address" }]),
    properties: {
      marketId: signal.marketId,
      city: signal.siteCity,
      apn: signal.siteApn,
      opportunityId: opportunity.id,
    },
    confidence: signal.siteAddress === "Address pending" ? 0.55 : 0.86,
    lastVerifiedAt: signal.source.accessedAt,
  });
}

async function upsertParcelEntity(opportunity: Opportunity, signal: PermitSignal) {
  const apn = signal.siteApn && !signal.siteApn.startsWith("pending-") ? signal.siteApn : null;

  if (!apn) {
    return null;
  }

  return upsertGraphEntity({
    entityType: "parcel",
    displayName: `APN ${apn}`,
    sourceSystem: "parcel",
    sourceId: `${signal.marketId}:${apn}`,
    aliases: compactAliases([{ alias: apn, aliasType: "parcel_number", confidence: 0.98 }]),
    properties: {
      marketId: signal.marketId,
      apn,
      ownerName: opportunity.parcelContext.ownerName,
      zoning: opportunity.parcelContext.zoning,
      landUse: opportunity.parcelContext.landUse,
      lotSizeAcres: opportunity.parcelContext.lotSizeAcres,
    },
    confidence: 0.94,
    lastVerifiedAt: opportunity.parcelContext.sourceAsOf,
  });
}

async function upsertPermitEntity(signal: PermitSignal) {
  return upsertGraphEntity({
    entityType: "permit",
    displayName: `${signal.permitNumber} ${signal.permitType}`,
    sourceSystem: "permit",
    sourceId: `${signal.marketId}:${signal.permitNumber}`,
    aliases: compactAliases([
      { alias: signal.permitNumber, aliasType: "permit_number", confidence: 0.99 },
      { alias: signal.projectName, aliasType: "name", confidence: 0.75 },
    ]),
    properties: {
      marketId: signal.marketId,
      jurisdiction: signal.jurisdiction,
      permitType: signal.permitType,
      permitSubtype: signal.permitSubtype,
      status: signal.status,
      issuedDate: signal.issuedDate,
      appliedDate: signal.appliedDate,
    },
    confidence: 0.96,
    lastVerifiedAt: signal.source.accessedAt,
  });
}

async function upsertOwnerEntity(opportunity: Opportunity) {
  const ownerName = opportunity.parcelContext.ownerName?.trim();

  if (!ownerName) {
    return null;
  }

  return upsertGraphEntity({
    entityType: "owner",
    displayName: ownerName,
    sourceSystem: "parcel-context",
    sourceId: `${opportunity.marketId}:${opportunity.parcelContext.apn}:${ownerName}`,
    aliases: compactAliases([{ alias: ownerName, aliasType: "name", confidence: 0.9 }]),
    properties: {
      marketId: opportunity.marketId,
      ownerMailingCity: opportunity.parcelContext.ownerMailingCity,
      ownershipEntityType: opportunity.parcelContext.ownershipEntityType,
    },
    confidence: opportunity.parcelContext.status === "missing" ? 0.55 : 0.84,
    lastVerifiedAt: opportunity.parcelContext.sourceAsOf,
  });
}

async function upsertContractorEntity(signal: PermitSignal) {
  const contractorName = signal.contractorName?.trim();

  if (!contractorName) {
    return null;
  }

  return upsertGraphEntity({
    entityType: "general_contractor",
    displayName: contractorName,
    sourceSystem: "permit-party",
    sourceId: `${signal.marketId}:${contractorName}`,
    aliases: compactAliases([{ alias: contractorName, aliasType: "name", confidence: 0.86 }]),
    properties: {
      marketId: signal.marketId,
      firstSeenPermit: signal.permitNumber,
    },
    confidence: 0.78,
    lastVerifiedAt: signal.source.accessedAt,
  });
}

function collectRelationship(
  relationships: GraphRelationship[],
  relationship: GraphRelationship
) {
  if (!relationships.some((candidate) => candidate.id === relationship.id)) {
    relationships.push(relationship);
  }
}

export async function buildOpportunityGraphContext(
  opportunity: Opportunity
): Promise<OpportunityGraphContext> {
  const entities = new Map<string, GraphEntity>();
  const relationships: GraphRelationship[] = [];
  const opportunityEntity = await upsertOpportunityEntity(opportunity);
  const ownerEntity = await upsertOwnerEntity(opportunity);

  entities.set(opportunityEntity.id, opportunityEntity);

  if (ownerEntity) {
    entities.set(ownerEntity.id, ownerEntity);
  }

  for (const signal of opportunity.signals) {
    const permitEntity = await upsertPermitEntity(signal);
    const propertyEntity = await upsertPropertyEntity(opportunity, signal);
    const parcelEntity = await upsertParcelEntity(opportunity, signal);
    const cityEntity = await upsertCityEntity(signal);
    const contractorEntity = await upsertContractorEntity(signal);

    for (const entity of [permitEntity, propertyEntity, parcelEntity, cityEntity, contractorEntity]) {
      if (entity) {
        entities.set(entity.id, entity);
      }
    }

    collectRelationship(
      relationships,
      await upsertGraphRelationship({
        fromEntityId: opportunityEntity.id,
        toEntityId: permitEntity.id,
        relationshipType: "has_permit",
        sourceSystem: "build-signals",
        sourceId: `${opportunity.id}:${signal.id}:has_permit`,
        confidence: 0.94,
        provenance: { opportunityId: opportunity.id, signalId: signal.id },
        lastVerifiedAt: signal.source.accessedAt,
        evidence: relationshipEvidence(signal),
      })
    );
    collectRelationship(
      relationships,
      await upsertGraphRelationship({
        fromEntityId: permitEntity.id,
        toEntityId: propertyEntity.id,
        relationshipType: "located_on",
        sourceSystem: "permit",
        sourceId: `${signal.id}:permit_property`,
        confidence: signal.siteAddress === "Address pending" ? 0.58 : 0.86,
        provenance: { signalId: signal.id, address: signal.siteAddress },
        lastVerifiedAt: signal.source.accessedAt,
        evidence: relationshipEvidence(signal),
      })
    );
    collectRelationship(
      relationships,
      await upsertGraphRelationship({
        fromEntityId: propertyEntity.id,
        toEntityId: cityEntity.id,
        relationshipType: "located_in",
        sourceSystem: "permit",
        sourceId: `${signal.id}:property_city`,
        confidence: 0.9,
        provenance: { signalId: signal.id, city: signal.siteCity },
        lastVerifiedAt: signal.source.accessedAt,
        evidence: relationshipEvidence(signal),
      })
    );

    if (parcelEntity) {
      collectRelationship(
        relationships,
        await upsertGraphRelationship({
          fromEntityId: propertyEntity.id,
          toEntityId: parcelEntity.id,
          relationshipType: "located_on",
          sourceSystem: "permit",
          sourceId: `${signal.id}:property_parcel`,
          confidence: 0.9,
          provenance: { signalId: signal.id, apn: signal.siteApn },
          lastVerifiedAt: signal.source.accessedAt,
          evidence: relationshipEvidence(signal),
        })
      );

      if (ownerEntity) {
        collectRelationship(
          relationships,
          await upsertGraphRelationship({
            fromEntityId: ownerEntity.id,
            toEntityId: parcelEntity.id,
            relationshipType: "owns",
            sourceSystem: "parcel-context",
            sourceId: `${opportunity.id}:${parcelEntity.id}:owner`,
            confidence: opportunity.parcelContext.status === "missing" ? 0.5 : 0.82,
            provenance: {
              opportunityId: opportunity.id,
              parcelSource: opportunity.parcelContext.sourceLabel,
            },
            lastVerifiedAt: opportunity.parcelContext.sourceAsOf,
            evidence: opportunity.evidence.map(evidenceFromSource),
          })
        );
      }
    }

    if (contractorEntity) {
      collectRelationship(
        relationships,
        await upsertGraphRelationship({
          fromEntityId: contractorEntity.id,
          toEntityId: permitEntity.id,
          relationshipType: "contractor_on",
          sourceSystem: "permit-party",
          sourceId: `${signal.id}:contractor`,
          confidence: 0.74,
          provenance: { signalId: signal.id, contractorName: signal.contractorName },
          lastVerifiedAt: signal.source.accessedAt,
          evidence: relationshipEvidence(signal),
        })
      );
    }
  }

  const detail = await getGraphEntityDetail(opportunityEntity.id);
  const related = detail?.related ?? (await listRelatedEntities(opportunityEntity.id));

  for (const relatedEntity of related) {
    entities.set(relatedEntity.entity.id, relatedEntity.entity);
    collectRelationship(relationships, relatedEntity.relationship);
  }

  return {
    opportunityEntity,
    entities: Array.from(entities.values()),
    relationships,
    related,
  };
}
