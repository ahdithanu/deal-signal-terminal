import { rawPermitSignals, opportunitySeeds } from "@/data/eldorado-west-slope";
import { markets } from "@/data/markets";
import {
  formatCity,
  formatDate,
  formatLotSizeAcres,
  formatOwnershipEntityType,
} from "@/lib/formatters";
import { loadParcelContext } from "@/lib/parcel-context-loader";
import {
  capitalProfileLabel,
  classifyOpportunity,
  scoreOpportunity,
} from "@/lib/scoring";
import type {
  LocalContext,
  MarketDefinition,
  Opportunity,
  OpportunitySeed,
  PermitTimelineEntry,
  PermitSignal,
  SignalType,
} from "@/types/domain";

export type FeedCategory =
  | "development"
  | "distress"
  | "repositioning"
  | "routine_maintenance"
  | "residential_infill";

function getSignalDate(signal: PermitSignal): string {
  return signal.issuedDate ?? signal.approvedDate ?? signal.appliedDate;
}

function buildSignalType(signals: PermitSignal[]): SignalType {
  if (signals.some((signal) => signal.permitType === "ACTIVITY PARCEL RESEARCH")) {
    return "parcel_research";
  }

  if (signals.length > 1) {
    return "permit_cluster";
  }

  return "permit";
}

function buildTimeline(signals: PermitSignal[]): PermitTimelineEntry[] {
  const entries = signals.flatMap((signal) => {
    const timeline: PermitTimelineEntry[] = [
      {
        id: `${signal.id}-applied`,
        permitNumber: signal.permitNumber,
        date: signal.appliedDate,
        stage: "applied",
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        description: signal.description,
        status: signal.status,
      },
    ];

    if (signal.approvedDate) {
      timeline.push({
        id: `${signal.id}-approved`,
        permitNumber: signal.permitNumber,
        date: signal.approvedDate,
        stage: "approved",
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        description: signal.description,
        status: signal.status,
      });
    }

    if (signal.issuedDate) {
      timeline.push({
        id: `${signal.id}-issued`,
        permitNumber: signal.permitNumber,
        date: signal.issuedDate,
        stage: "issued",
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        description: signal.description,
        status: signal.status,
      });
    }

    if (signal.finalizedDate) {
      timeline.push({
        id: `${signal.id}-finalized`,
        permitNumber: signal.permitNumber,
        date: signal.finalizedDate,
        stage: "finalized",
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        description: signal.description,
        status: signal.status,
      });
    }

    return timeline;
  });

  return entries.sort((left, right) => {
    const dateCompare = new Date(left.date).getTime() - new Date(right.date).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

function deriveOpportunity(seed: OpportunitySeed, market: MarketDefinition): Opportunity {
  const signals = seed.signalIds
    .map((signalId) => rawPermitSignals.find((signal) => signal.id === signalId))
    .filter((signal): signal is PermitSignal => Boolean(signal));

  if (signals.length === 0) {
    throw new Error(`Opportunity seed "${seed.id}" resolved to zero signals.`);
  }

  const score = scoreOpportunity(seed, signals, market);
  const sortedSignalDates = signals
    .map(getSignalDate)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  const firstSignal = signals[0];
  const parcelContext = loadParcelContext(firstSignal);
  const cityScore = market.cityScores[firstSignal.siteCity] ?? {
    tier: "edge",
  };

  const baseOpportunity: Opportunity = {
    id: seed.id,
    slug: seed.id,
    marketId: market.id,
    title: seed.title,
    projectName: seed.projectName ?? firstSignal.projectName ?? undefined,
    locationLabel: `${firstSignal.siteAddress}, ${formatCity(firstSignal.siteCity)}`,
    signalType: buildSignalType(signals),
    opportunityType: classifyOpportunity(seed, signals),
    projectScale: seed.projectScale,
    developmentStage: seed.developmentStage,
    localContext: "isolated",
    priorityScore: score.priorityScore,
    priorityBand: score.priorityBand,
    confidenceLevel: score.confidenceLevel,
    confidenceLabel: score.confidenceLabel,
    whyItMatters: seed.whyItMatters,
    nextStep: seed.nextStep,
    thesis: seed.thesis,
    missingFacts: seed.missingFacts,
    tags: seed.tags,
    signals,
    timeline: buildTimeline(signals),
    evidence: signals.map((signal) => signal.source),
    parcelContext,
    scoreBreakdown: score.scoreBreakdown,
    metadata: {
      latestSignalDate: sortedSignalDates[sortedSignalDates.length - 1],
      firstSignalDate: sortedSignalDates[0],
      jurisdiction: firstSignal.jurisdiction,
      siteApn: firstSignal.siteApn,
      corridorTier: cityScore.tier,
      propertyKind: seed.propertyKind,
      capitalProfile: "Pending",
      reportingWindow: `${market.sourceWindow.start} to ${market.sourceWindow.end}`,
    },
  };

  return {
    ...baseOpportunity,
    metadata: {
      ...baseOpportunity.metadata,
      capitalProfile: capitalProfileLabel(baseOpportunity),
    },
  };
}

function isWeakStandaloneSignal(opportunity: Opportunity): boolean {
  return (
    opportunity.confidenceLevel !== "high" &&
    opportunity.developmentStage === "disruption" &&
    opportunity.signals.every((signal) => /repair|shoring/i.test(signal.description))
  );
}

function clusterSignalWeight(opportunity: Opportunity): number {
  if (!shouldSurfaceInHomeFeed(opportunity)) {
    return 0;
  }

  return opportunity.confidenceLevel === "high"
    ? 2
    : opportunity.confidenceLevel === "medium"
      ? 1
      : 0;
}

function buildLocalContext(opportunity: Opportunity, pool: Opportunity[]): {
  localContext: LocalContext;
  contextSentence: string;
} {
  if (clusterSignalWeight(opportunity) === 0) {
    return {
      localContext: "isolated",
      contextSentence:
        "Nearby activity does not change the fact that this signal still looks too ambiguous on its own to read as part of a stronger local pattern.",
    };
  }

  const city = opportunity.signals[0]?.siteCity;
  const related = pool.filter((candidate) => candidate.id !== opportunity.id);
  const sameCityWeight = related
    .filter((candidate) => candidate.signals[0]?.siteCity === city)
    .reduce((sum, candidate) => sum + clusterSignalWeight(candidate), 0);
  const sameCorridorWeight = related
    .filter((candidate) => candidate.metadata.corridorTier === opportunity.metadata.corridorTier)
    .reduce((sum, candidate) => sum + clusterSignalWeight(candidate), 0);

  if (sameCityWeight >= 3) {
    return {
      localContext: "active_cluster",
      contextSentence: `Multiple developer-relevant signals in ${formatCity(
        city
      )} suggest active local development momentum, and that cluster is supported by stronger standalone signals rather than raw count alone.`,
    };
  }

  if (sameCityWeight >= 1) {
    return {
      localContext: "emerging_cluster",
      contextSentence: `Another credible development signal in ${formatCity(
        city
      )} suggests emerging local momentum, even if the local pipeline is still taking shape.`,
    };
  }

  if (sameCorridorWeight >= 3) {
    return {
      localContext: "emerging_cluster",
      contextSentence: `Other credible signals elsewhere in this ${opportunity.metadata.corridorTier} corridor suggest emerging development momentum, even if this specific site still looks more isolated within its city.`,
    };
  }

  return {
    localContext: "isolated",
    contextSentence:
      "For now, this appears to be a one-off signal in its immediate area rather than part of a broader local cluster.",
  };
}

function buildParcelWhyItMattersSentence(opportunity: Opportunity): string {
  const parcelContext = opportunity.parcelContext;

  if (parcelContext.status === "missing") {
    return "Parcel context is still missing, so ownership, zoning, and site-control timing remain open diligence questions rather than evidence-backed conclusions.";
  }

  const parcelFacts: string[] = [];

  if (parcelContext.landUse && parcelContext.zoning) {
    parcelFacts.push(
      `APN ${parcelContext.apn} reads as ${parcelContext.landUse.toLowerCase()} in ${parcelContext.zoning.toLowerCase()} zoning`
    );
  } else if (parcelContext.zoning) {
    parcelFacts.push(`APN ${parcelContext.apn} sits in ${parcelContext.zoning.toLowerCase()} zoning`);
  } else if (parcelContext.landUse) {
    parcelFacts.push(`APN ${parcelContext.apn} reads as ${parcelContext.landUse.toLowerCase()}`);
  }

  if (parcelContext.ownerName && parcelContext.ownershipEntityType !== "unknown") {
    parcelFacts.push(
      `${formatOwnershipEntityType(parcelContext.ownershipEntityType).toLowerCase()} control is tied to ${parcelContext.ownerName}`
    );
  }

  if (parcelContext.lastTransferDate) {
    parcelFacts.push(`the last recorded transfer dates to ${formatDate(parcelContext.lastTransferDate)}`);
  }

  if (parcelContext.lotSizeAcres != null) {
    parcelFacts.push(`the site spans about ${formatLotSizeAcres(parcelContext.lotSizeAcres).toLowerCase()}`);
  }

  const parcelRead = parcelFacts.length
    ? `${parcelFacts.join(", ")}, which helps anchor the signal in a real site context.`
    : "Parcel context adds some site-level support, but key ownership and zoning facts still need verification.";

  if (opportunity.opportunityType === "distress") {
    return `${parcelRead} That makes this more useful as a recapitalization or site-control watchpoint than a generic casualty event.`;
  }

  if (opportunity.opportunityType === "repositioning") {
    return `${parcelRead} That supports a landlord or site-repositioning read more than a generic repair interpretation.`;
  }

  return `${parcelRead} That helps separate genuine site motion from permit noise before broader market awareness catches up.`;
}

function buildParcelNextStepSentence(opportunity: Opportunity): string {
  const parcelContext = opportunity.parcelContext;
  const actions: string[] = [];

  if (parcelContext.status === "missing") {
    return "Verify APN-linked ownership, zoning, and parcel facts before committing more time, because the current site-control read is still incomplete.";
  }

  if (parcelContext.ownerName && parcelContext.ownershipEntityType === "entity") {
    actions.push(`review ${parcelContext.ownerName} for related entities, adjacent holdings, and recent filings`);
  } else if (!parcelContext.ownerName) {
    actions.push("confirm the current legal owner before deeper outreach");
  }

  if (parcelContext.zoning) {
    actions.push(`check entitlement history and zoning fit under ${parcelContext.zoning}`);
  }

  if (parcelContext.lastTransferDate) {
    actions.push(`pull transfer documents from ${formatDate(parcelContext.lastTransferDate)} to understand basis and timing`);
  }

  if (opportunity.developmentStage === "pre_construction") {
    actions.push("watch for follow-on site, utility, shell, or grading permits");
  } else if (opportunity.developmentStage === "active_construction") {
    actions.push("track execution permits and nearby competing pipeline timing");
  } else if (opportunity.developmentStage === "disruption") {
    actions.push("monitor for cleanup, demolition, insurance-driven rebuild, or disposition signals");
  }

  if (actions.length === 0) {
    return "Use the parcel context to confirm site control and development timing before escalating the lead.";
  }

  if (actions.length === 1) {
    return `${actions[0].charAt(0).toUpperCase()}${actions[0].slice(1)}.`;
  }

  return `${actions[0].charAt(0).toUpperCase()}${actions[0].slice(1)}, then ${actions
    .slice(1)
    .join(", ")}.`;
}

const derivedOpportunities = opportunitySeeds
  .map((seed) => {
    try {
      return deriveOpportunity(seed, markets["ca-eldorado-west-slope"]);
    } catch (error) {
      console.warn(
        error instanceof Error ? error.message : `Failed to derive opportunity for ${seed.id}.`
      );
      return null;
    }
  })
  .filter((opportunity): opportunity is Opportunity => Boolean(opportunity))
  .sort((left, right) => right.priorityScore - left.priorityScore);

const patternRelevantOpportunities = derivedOpportunities.filter(
  (opportunity) => clusterSignalWeight(opportunity) > 0
);

export const opportunities = derivedOpportunities.map((opportunity) => {
  const localPattern = buildLocalContext(opportunity, patternRelevantOpportunities);
  const parcelRead = buildParcelWhyItMattersSentence(opportunity);
  const parcelNextStep = buildParcelNextStepSentence(opportunity);

  return {
    ...opportunity,
    localContext: localPattern.localContext,
    whyItMatters: `${opportunity.whyItMatters} ${parcelRead} ${localPattern.contextSentence}`,
    nextStep: `${opportunity.nextStep} ${parcelNextStep}`,
  };
});

export function getFeedCategory(opportunity: Opportunity): FeedCategory {
  if (
    opportunity.signals.some(
      (signal) =>
        signal.permitType === "ACTIVITY DISASTER" ||
        /fire|storm damage|tree damage/i.test(signal.description)
    )
  ) {
    return "distress";
  }

  if (opportunity.metadata.propertyKind === "adu_infill") {
    return "residential_infill";
  }

  if (
    opportunity.signals.every((signal) => signal.permitType === "COMMERCIAL MECHANICAL") &&
    opportunity.signals.every((signal) => /hvac|unit|exhaust fan|duct/i.test(signal.description))
  ) {
    return "routine_maintenance";
  }

  if (
    opportunity.signals.some(
      (signal) =>
        signal.permitType === "ACTIVITY PARCEL RESEARCH" ||
        /demo|shoring|permit history/i.test(signal.description)
    )
  ) {
    return "repositioning";
  }

  return "development";
}

export function shouldSurfaceInHomeFeed(opportunity: Opportunity): boolean {
  if (getFeedCategory(opportunity) === "routine_maintenance") {
    return false;
  }

  if (opportunity.projectScale === "small") {
    return false;
  }

  if (isWeakStandaloneSignal(opportunity)) {
    return false;
  }

  return !opportunity.signals.every(
    (signal) => signal.permitType === "ACTIVITY PARCEL RESEARCH"
  );
}

export const homeFeedOpportunities = opportunities.filter(shouldSurfaceInHomeFeed);

export function getOpportunityBySlug(slug: string): Opportunity | undefined {
  return opportunities.find((opportunity) => opportunity.slug === slug);
}

export function getMarketById(marketId: string): MarketDefinition {
  return markets[marketId];
}
