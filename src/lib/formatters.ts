import type {
  ConfidenceLevel,
  DevelopmentStage,
  LocalContext,
  OwnershipEntityType,
  OpportunityType,
  ParcelContextStatus,
  PermitTimelineStage,
  PriorityBand,
  ProjectScale,
  PropertyKind,
  SignalType,
} from "@/types/domain";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Pending";
  }

  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

export function formatOpportunityType(value: OpportunityType): string {
  return {
    development: "Development",
    value_add: "Value-add",
    distress: "Distress",
    leasing: "Leasing",
    repositioning: "Repositioning",
  }[value];
}

export function formatSignalType(value: SignalType): string {
  return {
    permit: "Permit",
    permit_cluster: "Permit cluster",
    parcel_research: "Parcel research",
  }[value];
}

export function formatPriorityBand(value: PriorityBand): string {
  return {
    critical: "Critical",
    high: "High",
    active: "Active",
    monitor: "Monitor",
  }[value];
}

export function formatConfidenceLevel(value: ConfidenceLevel): string {
  return {
    high: "High",
    medium: "Medium",
    low: "Low",
  }[value];
}

export function formatPropertyKind(value: PropertyKind): string {
  return {
    self_storage: "Self-storage",
    medical_office: "Medical office",
    retail: "Retail",
    industrial: "Industrial",
    adu_infill: "ADU infill",
    single_family: "Single-family",
    estate_residential: "Estate residential",
    land_repositioning: "Land repositioning",
    luxury_residential: "Luxury residential",
  }[value];
}

export function formatProjectScale(value: ProjectScale): string {
  return {
    small: "Small scale",
    medium: "Medium scale",
    large: "Large scale",
  }[value];
}

export function formatDevelopmentStage(value: DevelopmentStage): string {
  return {
    early_signal: "Early signal",
    pre_construction: "Pre-construction",
    active_construction: "Active construction",
    disruption: "Disruption",
  }[value];
}

export function formatLocalContext(value: LocalContext): string {
  return {
    isolated: "Isolated",
    emerging_cluster: "Emerging cluster",
    active_cluster: "Active cluster",
  }[value];
}

export function formatOwnershipEntityType(value: OwnershipEntityType): string {
  return {
    individual: "Individual",
    entity: "Entity",
    public: "Public",
    unknown: "Unknown",
  }[value];
}

export function formatParcelContextStatus(value: ParcelContextStatus): string {
  return {
    seeded: "Seeded context",
    partial: "Partial context",
    missing: "Missing context",
  }[value];
}

export function formatPermitTimelineStage(value: PermitTimelineStage): string {
  return {
    applied: "Applied",
    approved: "Approved",
    issued: "Issued",
    finalized: "Finalized",
  }[value];
}

export function formatLotSizeAcres(value: number | null | undefined): string {
  if (value == null) {
    return "Pending";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} acres`;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) {
    return "Pending";
  }

  return currencyFormatter.format(value);
}

export function formatCity(city: string): string {
  return city
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
