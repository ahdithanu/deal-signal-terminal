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
  const title = sourceProjectTitle(record);

  if (title) {
    return title;
  }

  if (record.address) {
    return `${record.address} ${record.permit_type}`;
  }

  return `${record.jurisdiction} ${record.permit_type}`;
}

function sourceProjectTitle(record: StoredPermitRecord) {
  const raw = parseRawRecord(record.raw_json);
  const title = typeof raw.PROJECT_TITLE === "string" ? raw.PROJECT_TITLE.trim() : "";

  if (title) {
    return title;
  }

  return null;
}

function normalizeIdentifier(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:suite|ste|unit|apt|floor|fl)\b\s*[a-z0-9-]*/g, "")
    .replace(/\b(street|str)\b/g, "st")
    .replace(/\b(avenue|av)\b/g, "ave")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(place|pl)\b/g, "pl")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\s+/g, " ")
    .trim();
}

function recordIdentityKeys(record: StoredPermitRecord) {
  const keys: string[] = [];
  const parcel = record.parcel_number ? normalizeIdentifier(record.parcel_number) : "";
  const address = record.address ? normalizeIdentifier(record.address) : "";
  const sourceTitle = sourceProjectTitle(record);
  const title = sourceTitle ? normalizeIdentifier(sourceTitle) : "";
  const marketScope = record.market_id;
  const cityScope = `${marketScope}:${record.city ? normalizeIdentifier(record.city) : "unknown"}`;

  if (parcel && !/^pending/.test(parcel)) {
    keys.push(`${marketScope}:parcel:${parcel}`);
  }

  if (address && address.length >= 8) {
    keys.push(`${cityScope}:address:${address}`);
  }

  if (
    title &&
    (parcel || address) &&
    title.length >= 12 &&
    !/^(n\/a|none|unknown|project|permit|tenant improvement|new building|solar permit)$/i.test(
      title
    )
  ) {
    keys.push(`${cityScope}:project:${title}`);
  }

  return keys;
}

type PermitRecordCluster = {
  id: string;
  records: StoredPermitRecord[];
};

function clusterPermitRecords(records: StoredPermitRecord[]): PermitRecordCluster[] {
  const parent = new Map<string, string>();
  const recordKeys = new Map<string, string[]>();

  const find = (key: string): string => {
    const currentParent = parent.get(key) ?? key;

    if (currentParent === key) {
      parent.set(key, key);
      return key;
    }

    const root = find(currentParent);
    parent.set(key, root);
    return root;
  };

  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const record of records) {
    const keys = recordIdentityKeys(record);
    recordKeys.set(record.id, keys);

    for (const key of keys) {
      parent.set(key, parent.get(key) ?? key);
    }

    for (const key of keys.slice(1)) {
      union(keys[0], key);
    }
  }

  const clusters = new Map<string, StoredPermitRecord[]>();

  for (const record of records) {
    const keys = recordKeys.get(record.id) ?? [];
    const clusterKey = keys.length > 0 ? find(keys[0]) : `record:${record.id}`;
    const clusterRecords = clusters.get(clusterKey) ?? [];
    clusterRecords.push(record);
    clusters.set(clusterKey, clusterRecords);
  }

  return Array.from(clusters.values()).map((clusterRecords) => {
    const sortedRecords = [...clusterRecords].sort((left, right) =>
      signalDate(right).localeCompare(signalDate(left))
    );
    const keys = sortedRecords.flatMap(recordIdentityKeys).sort();
    const preferredKey =
      keys.find((key) => key.includes(":parcel:")) ??
      keys.find((key) => key.includes(":address:")) ??
      keys.find((key) => key.includes(":project:"));
    const fallbackId = sortedRecords[0]?.permit_number ?? sortedRecords[0]?.id ?? "record";

    return {
      id: slugify(preferredKey ?? fallbackId),
      records: sortedRecords,
    };
  });
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

function stageRank(stage: DevelopmentStage) {
  return {
    early_signal: 1,
    pre_construction: 2,
    active_construction: 3,
    disruption: 4,
  }[stage];
}

function scaleRank(scale: ProjectScale) {
  return {
    small: 1,
    medium: 2,
    large: 3,
  }[scale];
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

function buildSeed(cluster: PermitRecordCluster, signals: PermitSignal[]): OpportunitySeed {
  const primaryRecord = cluster.records.reduce((bestRecord, record) => {
    const bestScale = scaleRank(inferScale(bestRecord));
    const recordScale = scaleRank(inferScale(record));

    if (recordScale !== bestScale) {
      return recordScale > bestScale ? record : bestRecord;
    }

    return signalDate(record) > signalDate(bestRecord) ? record : bestRecord;
  }, cluster.records[0]);
  const primarySignal = signals.find((signal) => signal.permitNumber === primaryRecord.permit_number);
  const name = primarySignal?.projectName ?? projectName(primaryRecord);
  const opportunityType = cluster.records.some(
    (record) => classifyGeneratedRecord(record) === "distress"
  )
    ? "distress"
    : classifyGeneratedRecord(primaryRecord);
  const stage = cluster.records
    .map(inferStage)
    .sort((left, right) => stageRank(right) - stageRank(left))[0];
  const scale = cluster.records
    .map(inferScale)
    .sort((left, right) => scaleRank(right) - scaleRank(left))[0];
  const dates = cluster.records.map(signalDate).sort();
  const recordCount = cluster.records.length;
  const permitLabel = recordCount === 1 ? "permit record" : "permit records";
  const recordVerb = recordCount === 1 ? "gives" : "give";
  const permitTypes = Array.from(new Set(cluster.records.map((record) => record.permit_type))).slice(
    0,
    3
  );

  return {
    id: `generated-${primaryRecord.market_id}-${cluster.id}`,
    title: `${name} activity in ${primaryRecord.jurisdiction}`,
    projectName: name,
    signalIds: signals.map((signal) => signal.id),
    projectScale: scale,
    developmentStage: stage,
    propertyKind: inferPropertyKind(primaryRecord),
    opportunityHint: opportunityType,
    thesis: `${recordCount} sourced public ${permitLabel} at the same identified site ${recordVerb} the team a single diligence queue item to qualify before broader market visibility.`,
    whyItMatters: `The stored ${primaryRecord.report_label} data contains ${recordCount} ${permitLabel} from ${dates[0]} through ${dates[dates.length - 1]}, including ${permitTypes.join(", ").toLowerCase()} activity, without inferring ownership, value, or sponsor intent.`,
    nextStep:
      "Open the source record, confirm parcel ownership and entitlement context, then decide whether this is a direct outreach target, comparable pipeline read, or watchlist item.",
    missingFacts: [
      "Current owner and site-control status",
      "Confirmed development program and delivery timing",
      "Related permits, entitlements, or recorder filings tied to the same site",
    ],
    tags: [
      primaryRecord.jurisdiction,
      primaryRecord.city ?? "City pending",
      ...permitTypes,
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
  const signalsByRecordId = new Map(records.map((record, index) => [record.id, signals[index]]));
  const seeds = clusterPermitRecords(records).map((cluster) =>
    buildSeed(
      cluster,
      cluster.records
        .map((record) => signalsByRecordId.get(record.id))
        .filter((signal): signal is PermitSignal => Boolean(signal))
    )
  );

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
