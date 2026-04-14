export type OpportunityType =
  | "development"
  | "value_add"
  | "distress"
  | "leasing"
  | "repositioning";

export type SignalType = "permit" | "permit_cluster" | "parcel_research";

export type ConfidenceLevel = "high" | "medium" | "low";

export type PriorityBand = "critical" | "high" | "active" | "monitor";

export type ConfidenceLabel = "High" | "Medium" | "Low";

export type CorridorTier = "core" | "established" | "edge";

export type ProjectScale = "small" | "medium" | "large";

export type ParcelContextStatus = "seeded" | "partial" | "missing";

export type OwnershipEntityType = "individual" | "entity" | "public" | "unknown";

export type DevelopmentStage =
  | "early_signal"
  | "pre_construction"
  | "active_construction"
  | "disruption";

export type LocalContext = "isolated" | "emerging_cluster" | "active_cluster";

export type PropertyKind =
  | "self_storage"
  | "medical_office"
  | "retail"
  | "industrial"
  | "adu_infill"
  | "single_family"
  | "estate_residential"
  | "land_repositioning"
  | "luxury_residential";

export type ScoreDimensionKey =
  | "recency"
  | "permitImpact"
  | "scaleProxy"
  | "marketAttractiveness"
  | "rarity"
  | "strategicRelevance"
  | "dataCompleteness";

export type SourceEvidence = {
  id: string;
  label: string;
  reportLabel: string;
  pageUrl: string;
  url: string;
  recordId: string;
  publishedAt: string;
  accessedAt: string;
  excerpt: string;
};

export type PermitSignal = {
  id: string;
  permitNumber: string;
  marketId: string;
  jurisdiction: string;
  permitType: string;
  permitSubtype: string;
  description: string;
  status: string;
  appliedDate: string;
  approvedDate?: string | null;
  issuedDate?: string | null;
  finalizedDate?: string | null;
  contractorName?: string | null;
  projectName?: string | null;
  siteAddress: string;
  siteApn: string;
  siteCity: string;
  source: SourceEvidence;
};

export type ParcelContext = {
  apn: string;
  status: ParcelContextStatus;
  sourceLabel: string;
  sourceAsOf: string;
  ownerName: string | null;
  ownershipEntityType: OwnershipEntityType;
  ownerMailingCity: string | null;
  zoning: string | null;
  landUse: string | null;
  lotSizeAcres: number | null;
  lastTransferDate: string | null;
  transferContext: string | null;
  assessedValue: number | null;
  contextNotes: string[];
};

export type CityScore = {
  score: number;
  tier: CorridorTier;
  rationale: string;
};

export type MarketDefinition = {
  id: string;
  name: string;
  geography: string;
  analysisDate: string;
  sourceWindow: {
    start: string;
    end: string;
  };
  recordsScanned: number;
  sourcePageUrl: string;
  sourceDocumentUrl: string;
  reportLabel: string;
  cityScores: Record<string, CityScore>;
  permitTypeFrequencies: Record<string, number>;
};

export type OpportunitySeed = {
  id: string;
  title: string;
  projectName?: string;
  signalIds: string[];
  projectScale: ProjectScale;
  developmentStage: DevelopmentStage;
  propertyKind: PropertyKind;
  opportunityHint?: OpportunityType;
  thesis: string;
  whyItMatters: string;
  nextStep: string;
  missingFacts: string[];
  tags: string[];
};

export type ScoreBreakdown = {
  key: ScoreDimensionKey;
  label: string;
  score: number;
  maxScore: number;
  reason: string;
};

export type PermitTimelineStage = "applied" | "approved" | "issued" | "finalized";

export type PermitTimelineEntry = {
  id: string;
  permitNumber: string;
  date: string;
  stage: PermitTimelineStage;
  permitType: string;
  permitSubtype: string;
  description: string;
  status: string;
};

export type Opportunity = {
  id: string;
  slug: string;
  marketId: string;
  title: string;
  projectName?: string;
  locationLabel: string;
  signalType: SignalType;
  opportunityType: OpportunityType;
  projectScale: ProjectScale;
  developmentStage: DevelopmentStage;
  localContext: LocalContext;
  priorityScore: number;
  priorityBand: PriorityBand;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: ConfidenceLabel;
  whyItMatters: string;
  nextStep: string;
  thesis: string;
  missingFacts: string[];
  tags: string[];
  signals: PermitSignal[];
  timeline: PermitTimelineEntry[];
  evidence: SourceEvidence[];
  parcelContext: ParcelContext;
  scoreBreakdown: ScoreBreakdown[];
  metadata: {
    latestSignalDate: string;
    firstSignalDate: string;
    jurisdiction: string;
    siteApn: string;
    corridorTier: CorridorTier;
    propertyKind: PropertyKind;
    capitalProfile: string;
    reportingWindow: string;
  };
};

export type OpportunityMemo = {
  body: string;
  mode: "openai" | "rules";
  generatedAt: string;
  summary: string;
};
