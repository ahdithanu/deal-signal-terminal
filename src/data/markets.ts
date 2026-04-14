import type { MarketDefinition } from "@/types/domain";

export const elDoradoWestSlopeMarket: MarketDefinition = {
  id: "ca-eldorado-west-slope",
  name: "El Dorado County West Slope",
  geography:
    "El Dorado Hills, Cameron Park, Shingle Springs, Rescue, Placerville, Pollock Pines, Somerset, Camino, El Dorado, and nearby West Slope communities.",
  analysisDate: "2026-03-26",
  sourceWindow: {
    start: "2026-03-16",
    end: "2026-03-22",
  },
  recordsScanned: 174,
  sourcePageUrl:
    "https://www.eldoradocounty.ca.gov/Land-Use/Planning-and-Building/Building-Division/Permit-Activity-Reports",
  sourceDocumentUrl:
    "https://www.eldoradocounty.ca.gov/files/assets/county/v/1/documents/land-use/permit-activity-reports/2026/3.16-to-3.22.xlsx",
  reportLabel: "El Dorado County permit activity report, March 16-22, 2026",
  cityScores: {
    "EL DORADO HILLS": {
      score: 15,
      tier: "core",
      rationale: "Core Highway 50 growth corridor with stronger liquidity and tenant depth.",
    },
    "SHINGLE SPRINGS": {
      score: 13,
      tier: "core",
      rationale: "Core corridor infill node with decent access and lower basis than El Dorado Hills.",
    },
    "CAMERON PARK": {
      score: 12,
      tier: "established",
      rationale: "Established suburban node with steady absorption and buildable lots.",
    },
    RESCUE: {
      score: 12,
      tier: "established",
      rationale: "Residential growth pocket tied into the broader western slope commute shed.",
    },
    PLACERVILLE: {
      score: 11,
      tier: "established",
      rationale: "County seat with service demand and smaller-but-meaningful local deal flow.",
    },
    "DIAMOND SPRINGS": {
      score: 10,
      tier: "established",
      rationale: "Smaller service market with moderate liquidity.",
    },
    "EL DORADO": {
      score: 9,
      tier: "edge",
      rationale: "Thin but still relevant west slope inventory with selective repositioning potential.",
    },
    "POLLOCK PINES": {
      score: 7,
      tier: "edge",
      rationale: "More episodic liquidity and storm-related noise than core corridor nodes.",
    },
    CAMINO: {
      score: 7,
      tier: "edge",
      rationale: "Low-volume edge submarket better suited to niche owner-operator strategies.",
    },
    SOMERSET: {
      score: 6,
      tier: "edge",
      rationale: "Rural, lower-liquidity pocket where basis may be attractive but exits are slower.",
    },
  },
  permitTypeFrequencies: {
    RESIDENTIAL: 43,
    "ONLINE RESIDENTIAL ROOF REPLACEMENT": 21,
    "ONLINE RESIDENTIAL ELECTRICAL": 18,
    "ONLINE RESIDENTIAL MECHANICAL": 16,
    "ONLINE RESIDENTIAL SOLAR": 13,
    "ACTIVITY PARCEL RESEARCH": 12,
    "ONLINE RESIDENTIAL PLUMBING": 9,
    "RESIDENTIAL POOL SPA": 6,
    "RESIDENTIAL ACCESSORY STRUCTURE": 6,
    "RESIDENTIAL ELECTRICAL": 5,
    COMMERCIAL: 3,
    "RESIDENTIAL ACCESSORY DWELLING UNIT": 3,
    "RESIDENTIAL GRADING": 3,
    "RESIDENTIAL MECHANICAL": 3,
    "ACTIVITY DISASTER": 2,
    "DOT ENCROACHMENT": 2,
    "COMMERCIAL MECHANICAL": 2,
    "RESIDENTIAL DEMOLITION": 1,
  },
};

export const markets = {
  [elDoradoWestSlopeMarket.id]: elDoradoWestSlopeMarket,
};
