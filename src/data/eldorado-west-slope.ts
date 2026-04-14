import type { OpportunitySeed, PermitSignal, SourceEvidence } from "@/types/domain";

const reportLabel = "El Dorado County permit activity report, March 16-22, 2026";
const pageUrl =
  "https://www.eldoradocounty.ca.gov/Land-Use/Planning-and-Building/Building-Division/Permit-Activity-Reports";
const sourceUrl =
  "https://www.eldoradocounty.ca.gov/files/assets/county/v/1/documents/land-use/permit-activity-reports/2026/3.16-to-3.22.xlsx";

function buildEvidence(recordId: string, excerpt: string): SourceEvidence {
  return {
    id: `evidence-${recordId}`,
    label: "Public permit record",
    reportLabel,
    pageUrl,
    url: sourceUrl,
    recordId,
    publishedAt: "2026-03-22",
    accessedAt: "2026-03-26",
    excerpt,
  };
}

export const rawPermitSignals: PermitSignal[] = [
  {
    id: "signal-0390786",
    permitNumber: "0390786",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "ACTIVITY DISASTER",
    permitSubtype: "FIRE",
    description: "AIR PARK SELF STORAGE - CALFIRE REPORTED FIRE",
    status: "ISSUED",
    appliedDate: "2026-03-16",
    approvedDate: "2026-03-16",
    issuedDate: "2026-03-16",
    contractorName: null,
    projectName: "Air Park Self Storage",
    siteAddress: "3200 Cameron Park Dr",
    siteApn: "083182007",
    siteCity: "SHINGLE SPRINGS",
    source: buildEvidence(
      "0390786",
      "ACTIVITY DISASTER | FIRE | AIR PARK SELF STORAGE - CALFIRE REPORTED FIRE"
    ),
  },
  {
    id: "signal-0390788",
    permitNumber: "0390788",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL DEMOLITION",
    permitSubtype: "SINGLE FAMILY",
    description: "Domo manufactured dwelling",
    status: "ISSUED",
    appliedDate: "2026-03-16",
    approvedDate: "2026-03-16",
    issuedDate: "2026-03-16",
    contractorName: null,
    siteAddress: "7060 La Mesa Ln",
    siteApn: "046440012",
    siteCity: "SOMERSET",
    source: buildEvidence(
      "0390788",
      "RESIDENTIAL DEMOLITION | SINGLE FAMILY | Domo manufactured dwelling"
    ),
  },
  {
    id: "signal-0390789",
    permitNumber: "0390789",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "ACTIVITY DISASTER",
    permitSubtype: "TREE",
    description: "SNOW EVENT 2026 TREE DAMAGE TO ROOF",
    status: "CLOSED",
    appliedDate: "2026-03-16",
    approvedDate: "2026-03-16",
    issuedDate: "2026-03-16",
    contractorName: "D H CONSTRUCTION",
    siteAddress: "5621 Daisy Cir",
    siteApn: "077232004",
    siteCity: "POLLOCK PINES",
    source: buildEvidence(
      "0390789",
      "ACTIVITY DISASTER | TREE | SNOW EVENT 2026 TREE DAMAGE TO ROOF"
    ),
  },
  {
    id: "signal-0390792",
    permitNumber: "0390792",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL",
    permitSubtype: "ALTERATION/REPAIR",
    description: "SEE DISASTER 390789 REPAIR TREE DAMAGE FROM STORM",
    status: "ISSUED",
    appliedDate: "2026-03-16",
    approvedDate: "2026-03-16",
    issuedDate: "2026-03-16",
    contractorName: "D H CONSTRUCTION",
    siteAddress: "5621 Daisy Cir",
    siteApn: "077232004",
    siteCity: "POLLOCK PINES",
    source: buildEvidence(
      "0390792",
      "RESIDENTIAL | ALTERATION/REPAIR | SEE DISASTER 390789 REPAIR TREE DAMAGE FROM STORM"
    ),
  },
  {
    id: "signal-0390794",
    permitNumber: "0390794",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL",
    permitSubtype: "ALTERATION/REPAIR",
    description: "Remodel, roof, siding, electrical, plumbing, HVAC & frame",
    status: "ISSUED",
    appliedDate: "2026-03-16",
    approvedDate: "2026-03-16",
    issuedDate: "2026-03-16",
    contractorName: null,
    siteAddress: "6300 Green Valley Rd",
    siteApn: "317260032",
    siteCity: "PLACERVILLE",
    source: buildEvidence(
      "0390794",
      "RESIDENTIAL | ALTERATION/REPAIR | Remodel, roof, siding, electrical, plumbing, HVAC & frame"
    ),
  },
  {
    id: "signal-0390823",
    permitNumber: "0390823",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "COMMERCIAL",
    permitSubtype: "CONSTRUCTION TRAILER/OFFICE",
    description: "QUANTUM CARE-TEMPORARY SALES OFFICE TRAILER",
    status: "SUBMITTED",
    appliedDate: "2026-03-17",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    projectName: "Quantum Care",
    siteAddress: "2030 Carson Crossing Dr Bldg A",
    siteApn: "117490004",
    siteCity: "EL DORADO HILLS",
    source: buildEvidence(
      "0390823",
      "COMMERCIAL | CONSTRUCTION TRAILER/OFFICE | QUANTUM CARE-TEMPORARY SALES OFFICE TRAILER"
    ),
  },
  {
    id: "signal-0390825",
    permitNumber: "0390825",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL ACCESSORY STRUCTURE",
    permitSubtype: "GARAGE",
    description: "Detached Garage",
    status: "SUBMITTED",
    appliedDate: "2026-03-17",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "5192 Holly Dr",
    siteApn: "091190009",
    siteCity: "SHINGLE SPRINGS",
    source: buildEvidence(
      "0390825",
      "RESIDENTIAL ACCESSORY STRUCTURE | GARAGE | Detached Garage"
    ),
  },
  {
    id: "signal-0390826",
    permitNumber: "0390826",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL ACCESSORY DWELLING UNIT",
    permitSubtype: "MH ADU",
    description: "DOUBLE WIDE - SKYLINE",
    status: "SUBMITTED",
    appliedDate: "2026-03-17",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "5192 Holly Dr",
    siteApn: "091190009",
    siteCity: "SHINGLE SPRINGS",
    source: buildEvidence(
      "0390826",
      "RESIDENTIAL ACCESSORY DWELLING UNIT | MH ADU | DOUBLE WIDE - SKYLINE"
    ),
  },
  {
    id: "signal-0390889",
    permitNumber: "0390889",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "COMMERCIAL",
    permitSubtype: "ALTERATION/REPAIR",
    description: "SHORING EXISTING PAVILION 402 AND 404 ROOF PLAN",
    status: "ISSUED",
    appliedDate: "2026-03-19",
    approvedDate: "2026-03-19",
    issuedDate: "2026-03-20",
    contractorName: "UNLIMITED PROPERTY SERVICES INCORPORATED",
    siteAddress: "1461 Blackstone Pkwy",
    siteApn: "118181021",
    siteCity: "EL DORADO HILLS",
    source: buildEvidence(
      "0390889",
      "COMMERCIAL | ALTERATION/REPAIR | SHORING EXISTING PAVILION 402 AND 404 ROOF PLAN"
    ),
  },
  {
    id: "signal-0390891",
    permitNumber: "0390891",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL GRADING",
    permitSubtype: "GRADING WITH RETAINING WALL",
    description: "GRADING FOR SFD 390892",
    status: "SUBMITTED",
    appliedDate: "2026-03-19",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "3235 Wilkinson Rd",
    siteApn: "082552001",
    siteCity: "CAMERON PARK",
    source: buildEvidence(
      "0390891",
      "RESIDENTIAL GRADING | GRADING WITH RETAINING WALL | GRADING FOR SFD 390892"
    ),
  },
  {
    id: "signal-0390892",
    permitNumber: "0390892",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL",
    permitSubtype: "SINGLE FAMILY",
    description: "ENCROACHMENT RM PV 3.20KW, 8 MODULES (W/GRADING 390891)",
    status: "SUBMITTED",
    appliedDate: "2026-03-19",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "3235 Wilkinson Rd",
    siteApn: "082552001",
    siteCity: "CAMERON PARK",
    source: buildEvidence(
      "0390892",
      "RESIDENTIAL | SINGLE FAMILY | ENCROACHMENT RM PV 3.20KW, 8 MODULES (W/GRADING 390891)"
    ),
  },
  {
    id: "signal-0390901",
    permitNumber: "0390901",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "COMMERCIAL",
    permitSubtype: "DEMOLITION",
    description: "INTERIOR DEMO ONLY (NON-STRUCTURAL ELEMENTS)",
    status: "ISSUED",
    appliedDate: "2026-03-19",
    approvedDate: "2026-03-24",
    issuedDate: "2026-03-24",
    contractorName: null,
    siteAddress: "363 Green Valley Rd",
    siteApn: "124301027",
    siteCity: "EL DORADO HILLS",
    source: buildEvidence(
      "0390901",
      "COMMERCIAL | DEMOLITION | INTERIOR DEMO ONLY (NON-STRUCTURAL ELEMENTS)"
    ),
  },
  {
    id: "signal-0390913",
    permitNumber: "0390913",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "ACTIVITY PARCEL RESEARCH",
    permitSubtype: "PERMIT HISTORY",
    description: "DWELLING, POOL, GRADING, PLOT AND FLOOR PLANS",
    status: "SUBMITTED",
    appliedDate: "2026-03-20",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "3276 Bordeaux Dr",
    siteApn: "124120064",
    siteCity: "EL DORADO HILLS",
    source: buildEvidence(
      "0390913",
      "ACTIVITY PARCEL RESEARCH | PERMIT HISTORY | DWELLING, POOL, GRADING, PLOT AND FLOOR PLANS"
    ),
  },
  {
    id: "signal-0390914",
    permitNumber: "0390914",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "RESIDENTIAL ACCESSORY DWELLING UNIT",
    permitSubtype: "ADU",
    description: "PORTION OF GARAGE TO JADU",
    status: "SUBMITTED",
    appliedDate: "2026-03-20",
    approvedDate: null,
    issuedDate: null,
    contractorName: null,
    siteAddress: "3840 Homestead Rd",
    siteApn: "102231018",
    siteCity: "RESCUE",
    source: buildEvidence(
      "0390914",
      "RESIDENTIAL ACCESSORY DWELLING UNIT | ADU | PORTION OF GARAGE TO JADU"
    ),
  },
  {
    id: "signal-0390944",
    permitNumber: "0390944",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "COMMERCIAL MECHANICAL",
    permitSubtype: "EQUIPMENT",
    description: "ITW RIPPEY LASER - EXHAUST FAN, NEW DUCT",
    status: "VOID",
    appliedDate: "2026-03-20",
    approvedDate: null,
    issuedDate: null,
    contractorName: "ACCO ENGINEERED SYSTEMS",
    projectName: "ITW Rippey Laser",
    siteAddress: "5000 Hillsdale Cir",
    siteApn: "117084006",
    siteCity: "EL DORADO HILLS",
    source: buildEvidence(
      "0390944",
      "COMMERCIAL MECHANICAL | EQUIPMENT | ITW RIPPEY LASER - EXHAUST FAN, NEW DUCT"
    ),
  },
  {
    id: "signal-0390950",
    permitNumber: "0390950",
    marketId: "ca-eldorado-west-slope",
    jurisdiction: "El Dorado County",
    permitType: "COMMERCIAL MECHANICAL",
    permitSubtype: "ELECTRIC HVAC",
    description: "GOLDORADO - 5 TON UNIT",
    status: "ISSUED",
    appliedDate: "2026-03-20",
    approvedDate: "2026-03-20",
    issuedDate: "2026-03-20",
    contractorName: "ACCO ENGINEERED SYSTEMS",
    projectName: "Goldorado",
    siteAddress: "4080 Plaza Goldorado Cir",
    siteApn: "083453013",
    siteCity: "SHINGLE SPRINGS",
    source: buildEvidence(
      "0390950",
      "COMMERCIAL MECHANICAL | ELECTRIC HVAC | GOLDORADO - 5 TON UNIT"
    ),
  },
];

export const opportunitySeeds: OpportunitySeed[] = [
  {
    id: "air-park-self-storage-fire",
    title: "Air Park Self Storage fire event",
    projectName: "Air Park Self Storage",
    signalIds: ["signal-0390786"],
    projectScale: "large",
    developmentStage: "disruption",
    propertyKind: "self_storage",
    opportunityHint: "distress",
    thesis:
      "Commercial fire-related permit activity can create recapitalization or off-market acquisition openings before owners formally test the market.",
    whyItMatters:
      "This fire hits a commercially zoned self-storage parcel already held in an LLC structure, which can compress the timetable for a rebuild, recapitalization, or off-market disposition decision. It is still a disruption signal rather than a confirmed trade, but the ownership setup and site scale make it more actionable than a one-off casualty event.",
    nextStep:
      "Pull title, debt, and insurance context on Air Park Self Storage LLC immediately, then monitor for cleanup, demolition, or rebuild permits and compare the local storage pipeline for competing product.",
    missingFacts: [
      "Damage extent",
      "Insurance coverage",
      "Current occupancy and rent roll",
    ],
    tags: ["Distress", "Self-storage", "Commercial"],
  },
  {
    id: "quantum-care-sales-office",
    title: "Quantum Care sales office trailer",
    projectName: "Quantum Care",
    signalIds: ["signal-0390823"],
    projectScale: "large",
    developmentStage: "pre_construction",
    propertyKind: "medical_office",
    opportunityHint: "development",
    thesis:
      "Temporary sales office permits usually surface just ahead of more visible project marketing, preleasing, or phased site activation.",
    whyItMatters:
      "A sales office trailer on a sponsor-controlled mixed-use commercial parcel usually marks pre-construction, when delivery timing starts to matter before the broader market sees the next permit wave. That gives developers an earlier read on future supply, absorption pressure, and whether nearby pad or land pricing may tighten.",
    nextStep:
      "Confirm Carson Crossing Holdings LLC control, pull entitlement history for the pad, then monitor for shell, site, and utility permits while tracking nearby competing medical-office and mixed-use projects.",
    missingFacts: ["Phase size", "Tenant mix", "Go-live timeline"],
    tags: ["Development", "Healthcare", "Land"],
  },
  {
    id: "blackstone-pavilion-roof-shoring",
    title: "Blackstone pavilion roof shoring",
    signalIds: ["signal-0390889"],
    projectScale: "medium",
    developmentStage: "disruption",
    propertyKind: "retail",
    opportunityHint: "repositioning",
    thesis:
      "Structural repair permits on operating retail assets can create tenant disruption, capital needs, and re-tenanting opportunities before a full repositioning becomes obvious.",
    whyItMatters:
      "Roof shoring is a potential disruption signal worth monitoring rather than proof of a broader redevelopment move. If stabilization work expands, ownership may accelerate recapitalization, re-tenanting, or larger capex decisions that affect nearby retail supply timing.",
    nextStep:
      "Pull ownership, site plan, and entitlement history, then monitor for structural, facade, or tenant-improvement permits and benchmark nearby center vacancies and upgrade activity.",
    missingFacts: [
      "Affected suites or tenants",
      "Repair budget",
      "Expected downtime",
    ],
    tags: ["Retail", "Repositioning", "Capital event"],
  },
  {
    id: "green-valley-interior-demo",
    title: "Green Valley Road interior demo",
    signalIds: ["signal-0390901"],
    projectScale: "medium",
    developmentStage: "pre_construction",
    propertyKind: "retail",
    opportunityHint: "repositioning",
    thesis:
      "Interior-only commercial demolition is often the first public clue that a space is being recut for a new user, concept conversion, or lease-up push.",
    whyItMatters:
      "Interior demo on an existing retail-center parcel held by an incumbent ownership entity is more likely a tenant reset or merchandising move than land assembly, but it still matters for corridor competition and timing. It is an early repositioning signal, not a confirmed lease, so the key question is whether the landlord is recutting the space for a stronger user or broader center refresh.",
    nextStep:
      "Confirm Green Valley Retail Partners LLC control, map the suite footprint within the commercial zoning envelope, then monitor for tenant-improvement, facade, or sitework permits and compare nearby competing retail redevelopments.",
    missingFacts: ["Suite size", "Incoming tenant", "Landlord business plan"],
    tags: ["Repositioning", "Retail", "Early signal"],
  },
  {
    id: "itw-rippey-laser-upgrade",
    title: "ITW Rippey Laser exhaust upgrade",
    projectName: "ITW Rippey Laser",
    signalIds: ["signal-0390944"],
    projectScale: "medium",
    developmentStage: "early_signal",
    propertyKind: "industrial",
    opportunityHint: "leasing",
    thesis:
      "Equipment and ductwork permits at industrial users often precede production changes, vendor activity, and adjacent flex demand even when the permit itself looks small.",
    whyItMatters:
      "This is a potential industrial signal worth monitoring rather than a confirmed expansion lead. The voided permit and mechanical scope leave open the possibility that it was routine plant maintenance rather than growth-oriented capex.",
    nextStep:
      "First verify whether the voided permit was replaced; if it was, call industrial brokers to ask whether ITW is expanding production, retooling, or taking more nearby space.",
    missingFacts: [
      "Replacement permit number",
      "Capex amount",
      "Expansion versus maintenance",
    ],
    tags: ["Industrial", "Leasing", "Occupier signal"],
  },
  {
    id: "goldorado-hvac-signal",
    title: "Plaza Goldorado HVAC replacement",
    projectName: "Goldorado",
    signalIds: ["signal-0390950"],
    projectScale: "small",
    developmentStage: "active_construction",
    propertyKind: "retail",
    opportunityHint: "leasing",
    thesis:
      "Small commercial HVAC permits can still be useful tenant-readiness signals in neighborhood retail, especially where leasing activity is thin and every move matters.",
    whyItMatters:
      "This is a potential tenant-readiness signal worth monitoring, not a clear development lead. A new 5-ton unit can accompany turnover, but it often reflects ordinary replacement capex.",
    nextStep:
      "Identify the suite tied to the permit and ask the landlord or center broker whether it supports a new tenant, a renewal, or simple maintenance.",
    missingFacts: ["Suite number", "Tenant identity", "Lease timing"],
    tags: ["Retail", "Leasing", "Neighborhood center"],
  },
  {
    id: "holly-drive-adu-compound",
    title: "Holly Drive garage plus manufactured-home ADU",
    signalIds: ["signal-0390825", "signal-0390826"],
    projectScale: "small",
    developmentStage: "pre_construction",
    propertyKind: "adu_infill",
    opportunityHint: "development",
    thesis:
      "Paired garage and ADU permits on the same parcel are strong low-basis infill signals that can be repeated across similar lots in the corridor.",
    whyItMatters:
      "Garage plus manufactured-home ADU filings on one parcel point to an income-oriented small infill play, not routine owner-occupier work. That makes it a useful template for repeatable ADU sourcing in similar low-basis lots.",
    nextStep:
      "Pull zoning and lot details, then identify nearby parcels with similar setbacks and utilities to see whether the same ADU layout can be replicated.",
    missingFacts: [
      "Utility capacity",
      "Expected rent strategy",
      "Owner intent to hold or sell",
    ],
    tags: ["Development", "ADU", "Infill"],
  },
  {
    id: "wilkinson-road-site-prep",
    title: "Wilkinson Road hillside site prep",
    signalIds: ["signal-0390891", "signal-0390892"],
    projectScale: "medium",
    developmentStage: "active_construction",
    propertyKind: "single_family",
    opportunityHint: "development",
    thesis:
      "When grading and vertical permits show up together, land has moved from speculative paper value into active execution.",
    whyItMatters:
      "Grading paired with a vertical permit on a recently transferred entity-held hillside parcel moves this from paper inventory into real execution. That makes it more useful as a timing signal for nearby land competition, because the site now looks like builder-controlled product rather than a passive owner project.",
    nextStep:
      "Verify Wilkinson Ridge Holdings LLC and any affiliated builder entities, then monitor utility, foundation, and follow-on permits while checking whether adjacent hillside lots are under related control.",
    missingFacts: ["Builder identity", "Home size", "Adjacent lot inventory"],
    tags: ["Development", "Lot play", "Cameron Park"],
  },
  {
    id: "daisy-circle-storm-repair",
    title: "Daisy Circle storm damage repair",
    signalIds: ["signal-0390789", "signal-0390792"],
    projectScale: "small",
    developmentStage: "disruption",
    propertyKind: "single_family",
    opportunityHint: "distress",
    thesis:
      "Disaster plus repair permits often identify capital-stressed owners before any sale process emerges, especially in weather-hit pockets.",
    whyItMatters:
      "Storm damage plus a live repair permit shows a property under actual capital pressure, not just a casualty event. In thinner submarkets, that can surface off-market sales or contractor-led leads before owners list.",
    nextStep:
      "Pull ownership and occupancy, then contact the owner or contractor to confirm repair scope, insurance timing, and whether the property may trade once repairs are stabilized.",
    missingFacts: [
      "Repair budget",
      "Insurance proceeds",
      "Owner occupancy status",
    ],
    tags: ["Distress", "Storm damage", "Off-market"],
  },
  {
    id: "bordeaux-permit-file-pull",
    title: "Bordeaux permit file pull",
    signalIds: ["signal-0390913"],
    projectScale: "small",
    developmentStage: "early_signal",
    propertyKind: "luxury_residential",
    opportunityHint: "repositioning",
    thesis:
      "Permit-history pulls are weak signals on their own, but they can be unusually early indicators of pre-listing diligence or a large remodel plan.",
    whyItMatters:
      "This is a potential early signal worth monitoring, not a clear redevelopment lead. The file pull could indicate diligence or planning, but the request alone does not confirm transaction intent or construction timing.",
    nextStep:
      "Watch ownership transfers and broker chatter, then ask local architects or contractors whether a larger redesign or disposition is in motion.",
    missingFacts: [
      "Who requested the file",
      "Transaction intent",
      "Planned scope of work",
    ],
    tags: ["Early diligence", "Luxury", "Repositioning"],
  },
  {
    id: "green-valley-whole-home-rebuild",
    title: "Green Valley Road whole-home rebuild",
    signalIds: ["signal-0390794"],
    projectScale: "small",
    developmentStage: "active_construction",
    propertyKind: "estate_residential",
    opportunityHint: "value_add",
    thesis:
      "Multi-trade residential rebuild permits can flag capital-heavy repositioning plays and neighborhood comp resets before resale activity becomes visible.",
    whyItMatters:
      "This is a potential residential reset signal worth monitoring rather than a clear development lead. The multi-trade scope suggests more than cosmetic work, but it still reads as a smaller residential rebuild with uncertain pipeline relevance.",
    nextStep:
      "Confirm parcel characteristics and whether the sponsor is a homeowner or small operator, then track for listing timing or neighboring follow-on activity.",
    missingFacts: ["Budget", "Owner profile", "Intended hold period"],
    tags: ["Value-add", "Residential", "Comp reset"],
  },
  {
    id: "la-mesa-manufactured-home-demolition",
    title: "La Mesa manufactured-home demolition",
    signalIds: ["signal-0390788"],
    projectScale: "medium",
    developmentStage: "pre_construction",
    propertyKind: "land_repositioning",
    opportunityHint: "development",
    thesis:
      "Demolition permits on lower-basis residential sites can signal land reset, replacement housing, or a cleanup step ahead of sale.",
    whyItMatters:
      "Demolition on a recently transferred entity-held rural residential parcel reads more like a land reset than simple owner cleanup, which makes it relevant for replacement housing timing or a cleaned-up resale. The replacement plan is still unconfirmed, but the transfer timing and low assessed basis make this more actionable than a legacy teardown.",
    nextStep:
      "Confirm La Mesa Land Holdings LLC control, pull rural-residential zoning and utility constraints, then monitor for replacement permits, subdivision activity, or listing movement and assess nearby teardown and infill comps.",
    missingFacts: ["Replacement plan", "Lot dimensions", "Utility condition"],
    tags: ["Development", "Teardown", "Land basis"],
  },
  {
    id: "homestead-road-jadu-conversion",
    title: "Homestead Road JADU conversion",
    signalIds: ["signal-0390914"],
    projectScale: "small",
    developmentStage: "pre_construction",
    propertyKind: "adu_infill",
    opportunityHint: "development",
    thesis:
      "Garage-to-JADU conversions are small, but they are repeatable infill plays that point to owner appetite for rental yield in suburban growth pockets.",
    whyItMatters:
      "A garage-to-JADU conversion is small, but it is a clean signal that accessory-unit economics are working in Rescue. For smaller-scale owners, repeatability matters more than one-off project size.",
    nextStep:
      "Confirm parking and owner-occupancy rules, then compare nearby parcels and permits to see whether this neighborhood supports repeatable JADU activity.",
    missingFacts: ["Expected rent", "Parking compliance", "Owner occupancy"],
    tags: ["ADU", "Infill", "Micro-density"],
  },
];
