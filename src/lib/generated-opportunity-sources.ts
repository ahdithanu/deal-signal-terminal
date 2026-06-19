import { markets } from "@/data/markets";
import type { OpportunitySourceBatch } from "@/data/opportunity-sources";
import { listRecentPermitRecords, type StoredPermitRecord } from "@/lib/ingestion-store";
import type {
  DevelopmentStage,
  OpportunitySeed,
  OpportunityType,
  PermitSignal,
  ProjectScale,
  PropertyKind,
  SourceEvidence,
} from "@/types/domain";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function signalDate(record: StoredPermitRecord) {
  return record.issued_date ?? record.applied_date ?? record.accessed_at.slice(0, 10);
}

function parseRawRecord(rawJson: string | null) {
  if (!rawJson) {
    return {};
  }

  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function projectName(record: StoredPermitRecord) {
  const raw = parseRawRecord(record.raw_json);
  const title = typeof raw.PROJECT_TITLE === "string" ? raw.PROJECT_TITLE.trim() : "";

  if (title) {
    return title;
  }

  if (record.address) {
    return `${record.address} ${record.permit_type}`;
  }

  return `${record.jurisdiction} ${record.permit_type}`;
}

function searchableText(record: StoredPermitRecord) {
  return `${record.permit_type} ${record.permit_subtype ?? ""} ${record.description}`.toLowerCase();
}

function classifyGeneratedRecord(record: StoredPermitRecord): OpportunityType {
  const searchable = searchableText(record);

  if (/fire|storm|damage|disaster/.test(searchable)) {
    return "distress";
  }

  if (/lease|tenant|occupancy/.test(searchable)) {
    return "leasing";
  }

  if (/demolition|tenant improvement|interior|renovation|remodel/.test(searchable)) {
    return "repositioning";
  }

  if (/rezone|map|subdivision|planned development|coastal development/.test(searchable)) {
    return "development";
  }

  return "development";
}

function inferStage(record: StoredPermitRecord): DevelopmentStage {
  const searchable = searchableText(record);

  if (/fire|storm|damage|disaster/.test(searchable)) {
    return "disruption";
  }

  if (/rezone|map|subdivision|planned development|coastal development/.test(searchable)) {
    return "early_signal";
  }

  if (/grading|right of way|site development|encroachment|shoring/.test(searchable)) {
    return "pre_construction";
  }

  if (/construction|building|tenant improvement|utility|storm water/.test(searchable)) {
    return "active_construction";
  }

  return "early_signal";
}

function inferScale(record: StoredPermitRecord): ProjectScale {
  const valuation = record.valuation ?? 0;
  const searchable = searchableText(record);

  if (valuation >= 1_000_000 || /rezone|subdivision|planned development|tower|right of way/.test(searchable)) {
    return "large";
  }

  if (valuation >= 250_000 || /grading|site development|building|demolition|tenant improvement/.test(searchable)) {
    return "medium";
  }

  return "small";
}

function inferPropertyKind(record: StoredPermitRecord): PropertyKind {
  const searchable = searchableText(record);

  if (/industrial|warehouse/.test(searchable)) {
    return "industrial";
  }

  if (/storage/.test(searchable)) {
    return "self_storage";
  }

  if (/retail|tenant|interior/.test(searchable)) {
    return "retail";
  }

  if (/medical|health|care/.test(searchable)) {
    return "medical_office";
  }

  return "land_repositioning";
}

function buildEvidence(record: StoredPermitRecord): SourceEvidence {
  return {
    id: `generated-source-${record.id}`,
    label: `${record.source_name} ${record.permit_number}`,
    reportLabel: record.report_label,
    pageUrl: record.source_url,
    url: record.document_url,
    recordId: record.permit_number,
    publishedAt: record.published_at?.slice(0, 10) ?? record.accessed_at.slice(0, 10),
    accessedAt: record.accessed_at.slice(0, 10),
    excerpt: record.description.slice(0, 220),
  };
}

function buildSignal(record: StoredPermitRecord): PermitSignal {
  const date = signalDate(record);

  return {
    id: `generated-signal-${record.id}`,
    permitNumber: record.permit_number,
    marketId: record.market_id,
    jurisdiction: record.jurisdiction,
    permitType: record.permit_type,
    permitSubtype: record.permit_subtype ?? "Stored permit record",
    description: record.description,
    status: record.status ?? "Stored",
    appliedDate: record.applied_date ?? date,
    approvedDate: null,
    issuedDate: record.issued_date,
    finalizedDate: record.finaled_date,
    contractorName: record.contractor ?? record.applicant,
    projectName: projectName(record),
    siteAddress: record.address ?? "Address pending",
    siteApn: record.parcel_number ?? `pending-${record.id}`,
    siteCity: record.city?.toUpperCase() ?? "UNKNOWN",
    source: buildEvidence(record),
  };
}

function buildSeed(record: StoredPermitRecord, signal: PermitSignal): OpportunitySeed {
  const name = signal.projectName ?? projectName(record);
  const opportunityType = classifyGeneratedRecord(record);
  const stage = inferStage(record);
  const scale = inferScale(record);
  const date = signalDate(record);

  return {
    id: `generated-${record.market_id}-${slugify(record.permit_number)}`,
    title: `${name} moved in ${record.jurisdiction}`,
    projectName: name,
    signalIds: [signal.id],
    projectScale: scale,
    developmentStage: stage,
    propertyKind: inferPropertyKind(record),
    opportunityHint: opportunityType,
    thesis: `${record.permit_type} activity from ${record.jurisdiction} gives the team a sourced public-record signal to qualify before broader market visibility.`,
    whyItMatters: `The stored ${record.report_label} record shows ${record.permit_type.toLowerCase()} activity on ${date}, creating a diligence queue item without inventing ownership, value, or sponsor intent.`,
    nextStep:
      "Open the source record, confirm parcel ownership and entitlement context, then decide whether this is a direct outreach target, comparable pipeline read, or watchlist item.",
    missingFacts: [
      "Current owner and site-control status",
      "Confirmed development program and delivery timing",
      "Related permits, entitlements, or recorder filings tied to the same site",
    ],
    tags: [
      record.jurisdiction,
      record.city ?? "City pending",
      record.permit_type,
      "Generated from stored ingestion",
    ],
  };
}

function buildBatch(records: StoredPermitRecord[], marketId: string): OpportunitySourceBatch | null {
  const market = markets[marketId];

  if (!market) {
    return null;
  }

  const signals = records.map(buildSignal);
  const seeds = records.map((record, index) => buildSeed(record, signals[index]));

  return {
    market,
    seeds,
    signals,
  };
}

export async function buildGeneratedOpportunitySourceBatches(limit = 80) {
  const records = await listRecentPermitRecords(limit);
  const recordsByMarket = new Map<string, StoredPermitRecord[]>();

  for (const record of records) {
    const marketRecords = recordsByMarket.get(record.market_id) ?? [];
    marketRecords.push(record);
    recordsByMarket.set(record.market_id, marketRecords);
  }

  return Array.from(recordsByMarket.entries())
    .map(([marketId, marketRecords]) => buildBatch(marketRecords, marketId))
    .filter((batch): batch is OpportunitySourceBatch => Boolean(batch));
}
