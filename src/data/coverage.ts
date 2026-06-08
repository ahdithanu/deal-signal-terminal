export type CoverageStatus = "live" | "queued" | "evaluating";

export type CoverageSourceFamily =
  | "permit_activity"
  | "development_approvals"
  | "planning_entitlements"
  | "parcel_assessor"
  | "recorder_filings";

export type MarketCoverageDefinition = {
  id: string;
  name: string;
  region: string;
  status: CoverageStatus;
  sourceFamilies: CoverageSourceFamily[];
  liveMarketId?: string;
  reason: string;
  nextStep: string;
};

export const coverageSourceLabels: Record<CoverageSourceFamily, string> = {
  permit_activity: "Permit activity",
  development_approvals: "Development approvals",
  planning_entitlements: "Planning entitlements",
  parcel_assessor: "Parcel and assessor facts",
  recorder_filings: "Recorder filings",
};

export const marketCoverage: MarketCoverageDefinition[] = [
  {
    id: "ca-eldorado-west-slope",
    name: "El Dorado County West Slope",
    region: "Northern California",
    status: "live",
    liveMarketId: "ca-eldorado-west-slope",
    sourceFamilies: ["permit_activity", "parcel_assessor"],
    reason: "Launch county for proving weekly permit normalization, scoring, memo output, and data-health controls.",
    nextStep: "Expand from seeded parcel enrichment to repeatable county parcel refreshes.",
  },
  {
    id: "ca-san-diego-development",
    name: "San Diego",
    region: "Southern California",
    status: "live",
    liveMarketId: "ca-san-diego-development",
    sourceFamilies: ["development_approvals", "planning_entitlements"],
    reason: "Large coastal/infill market with an official open-data approvals feed and visible entitlement activity.",
    nextStep: "Connect approval records to parcel ownership and related building-permit follow-ons.",
  },
  {
    id: "tx-austin",
    name: "Austin",
    region: "Texas Triangle",
    status: "queued",
    sourceFamilies: ["permit_activity", "planning_entitlements", "parcel_assessor"],
    reason: "High-growth development market where early permit and entitlement motion can matter before broker coverage.",
    nextStep: "Validate city permit feed structure, parcel join keys, and weekly ingestion stability.",
  },
  {
    id: "tx-dallas-fort-worth",
    name: "Dallas-Fort Worth",
    region: "Texas Triangle",
    status: "queued",
    sourceFamilies: ["permit_activity", "planning_entitlements", "recorder_filings"],
    reason: "Large multi-jurisdiction metro where the product needs source orchestration across city and county boundaries.",
    nextStep: "Pick the first two municipalities and prove cross-jurisdiction normalization.",
  },
  {
    id: "fl-miami-dade",
    name: "Miami-Dade",
    region: "South Florida",
    status: "queued",
    sourceFamilies: ["permit_activity", "planning_entitlements", "parcel_assessor"],
    reason: "Dense infill and coastal redevelopment market with strong buyer demand for entitlement-aware sourcing.",
    nextStep: "Map permit, planning, and parcel sources before scoring any live opportunities.",
  },
  {
    id: "az-phoenix",
    name: "Phoenix",
    region: "Mountain West",
    status: "queued",
    sourceFamilies: ["permit_activity", "planning_entitlements"],
    reason: "Growth market where grading, subdivision, and utility work can become early institutional pipeline signals.",
    nextStep: "Identify repeatable city/county sources and compare permit cadence with San Diego ingestion.",
  },
  {
    id: "ga-atlanta",
    name: "Atlanta",
    region: "Southeast",
    status: "evaluating",
    sourceFamilies: ["permit_activity", "planning_entitlements", "parcel_assessor"],
    reason: "Broad suburban and infill activity, but source fragmentation needs diligence before launch commitments.",
    nextStep: "Assess source freshness, access terms, and parcel coverage quality.",
  },
  {
    id: "nc-raleigh-durham",
    name: "Raleigh-Durham",
    region: "Carolinas",
    status: "evaluating",
    sourceFamilies: ["permit_activity", "planning_entitlements"],
    reason: "Strong growth market where early project movement is valuable, but municipality selection matters.",
    nextStep: "Select first launch jurisdiction and confirm machine-readable source availability.",
  },
  {
    id: "co-denver",
    name: "Denver",
    region: "Mountain West",
    status: "evaluating",
    sourceFamilies: ["permit_activity", "planning_entitlements", "parcel_assessor"],
    reason: "Active infill and redevelopment market with useful signals if source coverage can stay fresh.",
    nextStep: "Validate permit feed reliability and ownership-context join path.",
  },
  {
    id: "wa-seattle",
    name: "Seattle",
    region: "Pacific Northwest",
    status: "evaluating",
    sourceFamilies: ["permit_activity", "planning_entitlements"],
    reason: "Entitlement-heavy market where source discipline is essential before ranking opportunities.",
    nextStep: "Review available permit and land-use feeds for stable IDs and historical backfill.",
  },
];

export function getCoverageByStatus(status: CoverageStatus) {
  return marketCoverage.filter((market) => market.status === status);
}

export function getCoverageSummary() {
  return {
    live: getCoverageByStatus("live").length,
    queued: getCoverageByStatus("queued").length,
    evaluating: getCoverageByStatus("evaluating").length,
    total: marketCoverage.length,
  };
}
