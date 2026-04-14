import type {
  ConfidenceLabel,
  ConfidenceLevel,
  MarketDefinition,
  Opportunity,
  OpportunitySeed,
  OpportunityType,
  PermitSignal,
  PriorityBand,
  ProjectScale,
  PropertyKind,
  ScoreBreakdown,
} from "@/types/domain";

function parseDate(value: string): number {
  return new Date(`${value}T12:00:00Z`).getTime();
}

function differenceInDays(start: string, end: string): number {
  return Math.max(0, Math.round((parseDate(end) - parseDate(start)) / 86_400_000));
}

function getSignalDate(signal: PermitSignal): string {
  return signal.issuedDate ?? signal.approvedDate ?? signal.appliedDate;
}

export function classifyOpportunity(
  seed: OpportunitySeed,
  signals: PermitSignal[]
): OpportunityType {
  if (seed.opportunityHint) {
    return seed.opportunityHint;
  }

  if (signals.some((signal) => signal.permitType === "ACTIVITY DISASTER")) {
    return "distress";
  }

  if (signals.some((signal) => signal.permitType === "ACTIVITY PARCEL RESEARCH")) {
    return "repositioning";
  }

  if (
    signals.some(
      (signal) =>
        signal.permitType === "COMMERCIAL" &&
        /demolition|interior demo|construction trailer/i.test(signal.description)
    )
  ) {
    return "leasing";
  }

  if (
    signals.some((signal) =>
      /adu|grading|single family|demolition/i.test(
        `${signal.permitType} ${signal.permitSubtype} ${signal.description}`
      )
    )
  ) {
    return "development";
  }

  return "value_add";
}

function recencyScore(latestSignalDate: string, market: MarketDefinition): ScoreBreakdown {
  const age = differenceInDays(latestSignalDate, market.analysisDate);

  if (age <= 3) {
    return {
      key: "recency",
      label: "Recency",
      score: 20,
      maxScore: 20,
      reason: "Signal landed within the last three days of the scoring window.",
    };
  }

  if (age <= 7) {
    return {
      key: "recency",
      label: "Recency",
      score: 16,
      maxScore: 20,
      reason: "Signal is still within a one-week action window.",
    };
  }

  return {
    key: "recency",
    label: "Recency",
    score: 12,
    maxScore: 20,
    reason: "Signal is recent enough to matter, but not same-week fresh.",
  };
}

function permitImpactScore(signals: PermitSignal[]): ScoreBreakdown {
  const composite = signals
    .map((signal) => {
      if (signal.permitType === "ACTIVITY DISASTER") {
        return /fire/i.test(signal.description) ? 17 : 10;
      }

      if (signal.permitType === "COMMERCIAL") {
        if (/construction trailer|sales office/i.test(signal.description)) {
          return 19;
        }

        if (/demolition|interior demo/i.test(signal.description)) {
          return 18;
        }

        return 15;
      }

      if (signal.permitType === "COMMERCIAL MECHANICAL") {
        if (signal.status === "VOID") {
          return 4;
        }

        if (/hvac|unit|exhaust fan|duct/i.test(signal.description)) {
          return 6;
        }

        return 8;
      }

      if (signal.permitType === "RESIDENTIAL GRADING") {
        return 18;
      }

      if (signal.permitType === "RESIDENTIAL ACCESSORY DWELLING UNIT") {
        return 5;
      }

      if (signal.permitType === "RESIDENTIAL DEMOLITION") {
        return 16;
      }

      if (signal.permitType === "ACTIVITY PARCEL RESEARCH") {
        return 4;
      }

      if (
        /remodel|roof|plumbing|electrical|hvac|frame|repair/i.test(signal.description)
      ) {
        return 7;
      }

      return 9;
    })
    .sort((left, right) => right - left);

  const score = Math.min(20, Math.round((composite[0] + (composite[1] ?? 0) * 0.35)));
  const descriptor = signals
    .map((signal) => `${signal.permitType.toLowerCase()} ${signal.permitSubtype.toLowerCase()}`)
    .join(", ");

  return {
    key: "permitImpact",
    label: "Permit impact",
    score,
    maxScore: 20,
    reason: `Weighted toward the highest-signal filing in the cluster: ${descriptor}.`,
  };
}

function scaleProxyScore(
  projectScale: ProjectScale,
  propertyKind: PropertyKind,
  signals: PermitSignal[]
): ScoreBreakdown {
  let score = 3;
  let reason =
    "The county report does not publish square footage or valuation here, so project scale is inferred from use type and permit scope.";

  if (projectScale === "large") {
    score = 15;
    reason =
      "Commercial staging, major distress, or sponsor-visible project activity points to a large-scale opportunity even without published valuation.";
  } else if (projectScale === "medium") {
    score = 10;
    reason =
      "Demolition, grading, or commercial repositioning language suggests meaningful development scope, but not clearly institutional scale from the permit alone.";
  } else if (propertyKind === "land_repositioning") {
    score = 9;
    reason =
      "The permit reads as a land-reset signal, but the eventual redevelopment scale is still unproven from the public record.";
  }

  return {
    key: "scaleProxy",
    label: "Scale proxy",
    score,
    maxScore: 15,
    reason,
  };
}

function marketScore(signals: PermitSignal[], market: MarketDefinition): ScoreBreakdown {
  const city = signals[0]?.siteCity ?? "EL DORADO HILLS";
  const cityScore = market.cityScores[city] ?? {
    score: 8,
    tier: "edge",
    rationale: "No city-specific tier available, so the market score uses a conservative default.",
  };

  return {
    key: "marketAttractiveness",
    label: "Market attractiveness",
    score: cityScore.score,
    maxScore: 15,
    reason: cityScore.rationale,
  };
}

function rarityScore(signals: PermitSignal[], market: MarketDefinition): ScoreBreakdown {
  const signalScores = signals.map((signal) => {
    const frequency = market.permitTypeFrequencies[signal.permitType] ?? 18;

    if (frequency <= 2) return 10;
    if (frequency <= 3) return 9;
    if (frequency <= 6) return 8;
    if (frequency <= 12) return 6;
    if (frequency <= 20) return 4;
    return 3;
  });

  const score = Math.round(signalScores.reduce((sum, value) => sum + value, 0) / signalScores.length);
  const rarestType = signals
    .slice()
    .sort((left, right) => {
      const leftFreq = market.permitTypeFrequencies[left.permitType] ?? 18;
      const rightFreq = market.permitTypeFrequencies[right.permitType] ?? 18;
      return leftFreq - rightFreq;
    })[0];
  const rarestFrequency = market.permitTypeFrequencies[rarestType.permitType] ?? 18;

  return {
    key: "rarity",
    label: "Signal rarity",
    score,
    maxScore: 10,
    reason: `${rarestType.permitType} appeared ${rarestFrequency} time(s) in the 174-record source week.`,
  };
}

function strategicRelevanceScore(
  projectScale: ProjectScale,
  propertyKind: PropertyKind,
  opportunityType: OpportunityType
): ScoreBreakdown {
  let score = 3;

  if (propertyKind === "land_repositioning") {
    score = 10;
  } else if (projectScale === "large" && opportunityType === "development") {
    score = 10;
  } else if (projectScale === "large" && opportunityType === "distress") {
    score = 9;
  } else if (
    projectScale === "medium" &&
    (opportunityType === "development" || opportunityType === "repositioning")
  ) {
    score = 8;
  } else if (projectScale === "medium" && opportunityType === "leasing") {
    score = 8;
  } else if (projectScale === "small" && propertyKind === "adu_infill") {
    score = 1;
  } else if (projectScale === "small") {
    score = 2;
  }

  return {
    key: "strategicRelevance",
    label: "Strategic relevance",
    score,
    maxScore: 10,
    reason:
      "Higher scores go to medium- and large-scale signals with clearer land, redevelopment, or pipeline implications for developers.",
  };
}

function confidenceLabelForLevel(level: ConfidenceLevel): ConfidenceLabel {
  const labels: Record<ConfidenceLevel, ConfidenceLabel> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return labels[level];
}

function dataCompletenessScore(
  seed: OpportunitySeed,
  signals: PermitSignal[]
): { breakdown: ScoreBreakdown; score: number } {
  let score = 4;

  if (signals.length > 1) {
    score += 2;
  }

  if (signals[0]?.siteApn) {
    score += 1;
  }

  if (seed.projectName || signals[0]?.projectName) {
    score += 1;
  }

  if (signals.some((signal) => signal.contractorName)) {
    score += 1;
  }

  if (seed.missingFacts.length <= 3) {
    score += 1;
  }

  score = Math.min(10, score);

  return {
    score,
    breakdown: {
      key: "dataCompleteness",
      label: "Data completeness",
      score,
      maxScore: 10,
      reason:
        "Confidence rises when the record includes multiple filings, a parcel number, and enough context to support outreach.",
    },
  };
}

function confidenceAssessment(
  seed: OpportunitySeed,
  signals: PermitSignal[],
  opportunityType: OpportunityType,
  completenessScore: number
): { confidenceLevel: ConfidenceLevel; confidenceLabel: ConfidenceLabel } {
  const clarityScore = signals.every(
    (signal) =>
      signal.permitType === "COMMERCIAL MECHANICAL" ||
      signal.permitType === "ACTIVITY PARCEL RESEARCH"
  )
    ? 0
    : signals.some(
          (signal) =>
            signal.permitType === "ACTIVITY DISASTER" ||
            signal.permitType === "COMMERCIAL" ||
            signal.permitType === "RESIDENTIAL GRADING" ||
            signal.permitType === "RESIDENTIAL DEMOLITION"
        )
      ? 2
      : 1;

  let implicationScore = 0;
  if (opportunityType === "development" && seed.projectScale === "large") {
    implicationScore = 2;
  } else if (
    opportunityType === "development" ||
    opportunityType === "repositioning" ||
    opportunityType === "distress"
  ) {
    implicationScore = 1;
  }

  const completenessBand = completenessScore >= 8 ? 2 : completenessScore >= 6 ? 1 : 0;

  let ambiguityPenalty = 0;
  if (signals.some((signal) => signal.status === "VOID")) {
    ambiguityPenalty += 2;
  }

  if (
    signals.every(
      (signal) =>
        signal.permitType === "COMMERCIAL MECHANICAL" ||
        signal.permitType === "ACTIVITY PARCEL RESEARCH"
    )
  ) {
    ambiguityPenalty += 2;
  }

  if (seed.projectScale === "small") {
    ambiguityPenalty += 1;
  }

  const confidenceScore = clarityScore + implicationScore + completenessBand - ambiguityPenalty;
  const confidenceLevel: ConfidenceLevel =
    confidenceScore >= 5 ? "high" : confidenceScore >= 2 ? "medium" : "low";

  return {
    confidenceLevel,
    confidenceLabel: confidenceLabelForLevel(confidenceLevel),
  };
}

export function scoreOpportunity(
  seed: OpportunitySeed,
  signals: PermitSignal[],
  market: MarketDefinition
): {
  scoreBreakdown: ScoreBreakdown[];
  priorityScore: number;
  priorityBand: PriorityBand;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: ConfidenceLabel;
} {
  const opportunityType = classifyOpportunity(seed, signals);
  const latestSignalDate = signals
    .map(getSignalDate)
    .sort((left, right) => parseDate(right) - parseDate(left))[0];

  const completeness = dataCompletenessScore(seed, signals);
  const confidence = confidenceAssessment(
    seed,
    signals,
    opportunityType,
    completeness.score
  );

  const scoreBreakdown = [
    recencyScore(latestSignalDate, market),
    permitImpactScore(signals),
    scaleProxyScore(seed.projectScale, seed.propertyKind, signals),
    marketScore(signals, market),
    rarityScore(signals, market),
    strategicRelevanceScore(seed.projectScale, seed.propertyKind, opportunityType),
    completeness.breakdown,
  ];

  const priorityScore = scoreBreakdown.reduce((sum, dimension) => sum + dimension.score, 0);

  const priorityBand: PriorityBand =
    priorityScore >= 82 ? "critical" : priorityScore >= 72 ? "high" : priorityScore >= 60 ? "active" : "monitor";

  return {
    scoreBreakdown,
    priorityScore,
    priorityBand,
    confidenceLevel: confidence.confidenceLevel,
    confidenceLabel: confidence.confidenceLabel,
  };
}

export function capitalProfileLabel(opportunity: Opportunity): string {
  const scaleScore =
    opportunity.scoreBreakdown.find((dimension) => dimension.key === "scaleProxy")?.score ?? 0;

  if (scaleScore >= 13) {
    return "Larger capital event";
  }

  if (scaleScore >= 10) {
    return "Mid-sized capex";
  }

  return "Early or light capex";
}
