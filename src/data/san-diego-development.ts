import type { OpportunitySeed, PermitSignal, SourceEvidence } from "@/types/domain";

const reportLabel =
  "City of San Diego approvals for development projects, 2026 issued approvals";
const pageUrl = "https://data.sandiego.gov/datasets/development-permits/";
const sourceUrl =
  "https://seshat.datasd.org/development_permits/approvals_issued_2026_datasd.csv";
const publishedAt = "2026-06-08";
const accessedAt = "2026-06-08";

function buildEvidence(recordId: string, label: string, excerpt: string): SourceEvidence {
  return {
    id: `san-diego-${recordId}`,
    label,
    reportLabel,
    pageUrl,
    url: sourceUrl,
    recordId,
    publishedAt,
    accessedAt,
    excerpt,
  };
}

export const rawPermitSignals: PermitSignal[] = [
  {
    id: "san-diego-utc-res-tower-encroachment-1980445",
    permitNumber: "1980445",
    marketId: "ca-san-diego-development",
    jurisdiction: "City of San Diego",
    permitType: "Encroachment Agreement",
    permitSubtype: "Issued approval",
    description:
      "Encroachment maintenance and removal agreement for private retaining wall footing and subdrains within the right of way tied to UTC Res Tower site work.",
    status: "Issued",
    appliedDate: "2017-07-13",
    approvedDate: "2026-04-28",
    issuedDate: "2026-04-28",
    finalizedDate: null,
    contractorName: "Westfield, Raul Gonzales",
    projectName: "UTC Res Tower Grading and Public Improvements",
    siteAddress: "4545 LA JOLLA VILLAGE DR",
    siteApn: "3450112000",
    siteCity: "SAN DIEGO",
    source: buildEvidence(
      "1980445",
      "San Diego development approval 1980445",
      "Private retaining wall footing and subdrains within the right of way."
    ),
  },
  {
    id: "san-diego-mission-valley-rezone-2607768",
    permitNumber: "2607768",
    marketId: "ca-san-diego-development",
    jurisdiction: "City of San Diego",
    permitType: "Rezone",
    permitSubtype: "Issued approval",
    description:
      "City Council approval removed 19.82 acres from the Community Plan Implementation Overlay Zone so the Mission Valley Community Plan update zone can apply.",
    status: "Issued",
    appliedDate: "2022-12-05",
    approvedDate: "2026-05-04",
    issuedDate: "2026-05-04",
    finalizedDate: null,
    contractorName: "Mission Valley Shoppingtown LL, Alison Wais",
    projectName: "Dgtl-Mission Valley West Amendment",
    siteAddress: "1640 CAMINO DEL RIO NORTH",
    siteApn: "4380305400",
    siteCity: "SAN DIEGO",
    source: buildEvidence(
      "2607768",
      "San Diego development approval 2607768",
      "Removal of 19.82 acres from the CPIOZ for the Mission Valley site."
    ),
  },
  {
    id: "san-diego-mission-valley-grading-row-2620548",
    permitNumber: "2620548",
    marketId: "ca-san-diego-development",
    jurisdiction: "City of San Diego",
    permitType: "Grading + Right of Way Permit",
    permitSubtype: "Issued approval",
    description:
      "Grading, right-of-way, storm water, utility lateral, driveway, curb ramp, and traffic signal work for a Mission Valley project site.",
    status: "Issued",
    appliedDate: "2022-12-20",
    approvedDate: "2026-02-19",
    issuedDate: "2026-02-19",
    finalizedDate: null,
    contractorName: "Cole Storey",
    projectName: "Mission Valley Infrastructure Readiness",
    siteAddress: "2310 CAMINO DEL RIO NORTH",
    siteApn: "4380521600",
    siteCity: "SAN DIEGO",
    source: buildEvidence(
      "2620548",
      "San Diego development approval 2620548",
      "Grading, right-of-way, traffic signal, storm water, and utility lateral work."
    ),
  },
  {
    id: "san-diego-churchward-geotech-change-2621420",
    permitNumber: "2621420",
    marketId: "ca-san-diego-development",
    jurisdiction: "City of San Diego",
    permitType: "Construction Change - Eng.",
    permitSubtype: "Issued approval",
    description:
      "Construction change to engineering approval PTS-655007 identifying the geotechnical engineer of record for the Churchward Street project.",
    status: "Issued",
    appliedDate: "2023-01-03",
    approvedDate: "2026-03-13",
    issuedDate: "2026-03-13",
    finalizedDate: null,
    contractorName: "Kyro Development",
    projectName: "Churchward Street Engineering Change",
    siteAddress: "5432 CHURCHWARD ST",
    siteApn: "5482045100",
    siteCity: "SAN DIEGO",
    source: buildEvidence(
      "2621420",
      "San Diego development approval 2621420",
      "Construction change naming the geotechnical engineer of record."
    ),
  },
];

export const opportunitySeeds: OpportunitySeed[] = [
  {
    id: "san-diego-utc-res-tower-site-work",
    title: "UTC tower site work shows institutional-scale development motion",
    projectName: "UTC Res Tower Grading and Public Improvements",
    signalIds: ["san-diego-utc-res-tower-encroachment-1980445"],
    projectScale: "large",
    developmentStage: "pre_construction",
    propertyKind: "land_repositioning",
    opportunityHint: "development",
    thesis:
      "A UTC high-rise residential project with right-of-way, retaining wall, subdrain, grading, easement, and public-improvement language is a stronger development timing signal than a generic permit issue.",
    whyItMatters:
      "The approval ties private structural and drainage work to public right-of-way obligations at a major UTC address, which is the kind of site-motion cue acquisitions teams can use to track sponsor timing.",
    nextStep:
      "Pull the associated grading, right-of-way, shoring, easement, and public-improvement approvals to confirm the current execution path and the parties controlling the schedule.",
    missingFacts: [
      "Current ownership and development-control stack",
      "Unit count, delivery schedule, and capital partner",
      "Whether the public-improvement package has follow-on permits or bond releases",
    ],
    tags: ["San Diego", "UTC", "high-rise", "right-of-way", "site work"],
  },
  {
    id: "san-diego-mission-valley-rezone-reset",
    title: "Mission Valley rezone removes overlay friction on a large site",
    projectName: "Dgtl-Mission Valley West Amendment",
    signalIds: ["san-diego-mission-valley-rezone-2607768"],
    projectScale: "large",
    developmentStage: "early_signal",
    propertyKind: "land_repositioning",
    opportunityHint: "development",
    thesis:
      "A 19.82-acre Mission Valley zoning reset is a credible pre-development signal because entitlement friction changed before a marketed process would necessarily surface.",
    whyItMatters:
      "The issued approval removes an overlay constraint and lets the Mission Valley Community Plan update zoning apply to the site, creating a clearer redevelopment watchpoint.",
    nextStep:
      "Review the council action, parcel map, prior overlay ordinance, and any submitted site plans to understand whether the zoning change unlocks near-term development or longer-cycle optionality.",
    missingFacts: [
      "Approved zoning standards now applying to the site",
      "Any active site plan, subdivision, or building permit package",
      "Sponsor intent, leasing status, and ownership basis",
    ],
    tags: ["San Diego", "Mission Valley", "rezone", "large site", "entitlements"],
  },
  {
    id: "san-diego-mission-valley-infrastructure-readiness",
    title: "Mission Valley grading and ROW approval points to site readiness",
    projectName: "Mission Valley Infrastructure Readiness",
    signalIds: ["san-diego-mission-valley-grading-row-2620548"],
    projectScale: "medium",
    developmentStage: "active_construction",
    propertyKind: "land_repositioning",
    opportunityHint: "development",
    thesis:
      "Grading, right-of-way, signal, stormwater, utility, driveway, and curb-ramp scope suggests the site is moving from entitlement record to physical readiness.",
    whyItMatters:
      "The approval bundles civil and access work that often precedes vertical execution, so it gives the team a concrete timing cue to investigate rather than a broad market hunch.",
    nextStep:
      "Check related traffic, stormwater, utility, and building approvals to decide whether this is a direct acquisition lead, a comparable pipeline read, or an infrastructure-led watch item.",
    missingFacts: [
      "Final development program and vertical permit status",
      "Whether the project is public, private, or mixed-use civic-adjacent",
      "Current owner, developer, and contractor relationships",
    ],
    tags: ["San Diego", "Mission Valley", "grading", "right-of-way", "utilities"],
  },
];
