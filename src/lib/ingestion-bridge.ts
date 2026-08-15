import { createHash, timingSafeEqual } from "node:crypto";

import {
  finishIngestionRun,
  startIngestionRun,
  upsertPermitRecord,
  upsertSourceDocument,
} from "@/lib/ingestion-store";
import {
  INGESTION_BRIDGE_VERSION,
  type ImportedApprovalStage,
  type NationwideImportResult,
  type NationwideIngestionBatch,
  type NationwideIngestionRecord,
} from "@/types/ingestion-bridge";

const MAX_BATCH_RECORDS = 500;
const APPROVAL_STAGES = new Set<ImportedApprovalStage>([
  "pre_approval",
  "approved",
  "denied",
  "withdrawn",
  "unknown",
]);

export class IngestionBridgeValidationError extends Error {}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IngestionBridgeValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, maxLength = 2_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new IngestionBridgeValidationError(`${label} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new IngestionBridgeValidationError(`${label} exceeds ${maxLength} characters.`);
  }
  return result;
}

function optionalString(value: unknown, label: string, maxLength = 2_000) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requiredString(value, label, maxLength);
}

function optionalNumber(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new IngestionBridgeValidationError(`${label} must be a finite number.`);
  }
  return value;
}

function isoDate(value: unknown, label: string, required = false) {
  const parsed = required ? requiredString(value, label, 64) : optionalString(value, label, 64);
  if (!parsed) {
    return null;
  }
  if (Number.isNaN(Date.parse(parsed))) {
    throw new IngestionBridgeValidationError(`${label} must be an ISO-8601 date or timestamp.`);
  }
  return parsed;
}

function safeObject(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return {};
  }
  return objectValue(value, label);
}

function parseRecord(value: unknown, index: number): NationwideIngestionRecord {
  const row = objectValue(value, `records[${index}]`);
  const location = safeObject(row.location, `records[${index}].location`);
  const parties = safeObject(row.parties, `records[${index}].parties`);
  const dates = safeObject(row.dates, `records[${index}].dates`);
  const evidence = objectValue(row.evidence, `records[${index}].evidence`);
  const approvalStage = requiredString(
    row.approvalStage,
    `records[${index}].approvalStage`,
    32
  ) as ImportedApprovalStage;
  const confidence = optionalNumber(row.confidence, `records[${index}].confidence`);

  if (!APPROVAL_STAGES.has(approvalStage)) {
    throw new IngestionBridgeValidationError(
      `records[${index}].approvalStage is not supported.`
    );
  }
  if (confidence === null || confidence < 0 || confidence > 1) {
    throw new IngestionBridgeValidationError(
      `records[${index}].confidence must be between 0 and 1.`
    );
  }

  const attributes = row.attributes === undefined ? {} : objectValue(row.attributes, `records[${index}].attributes`);

  return {
    externalRecordId: requiredString(row.externalRecordId, `records[${index}].externalRecordId`, 500),
    marketId: requiredString(row.marketId, `records[${index}].marketId`, 160),
    jurisdiction: requiredString(row.jurisdiction, `records[${index}].jurisdiction`, 255),
    approvalStage,
    applicationNumber: optionalString(row.applicationNumber, `records[${index}].applicationNumber`, 255),
    permitNumber: optionalString(row.permitNumber, `records[${index}].permitNumber`, 255),
    permitType: requiredString(row.permitType, `records[${index}].permitType`, 255),
    permitSubtype: optionalString(row.permitSubtype, `records[${index}].permitSubtype`, 255),
    workClass: optionalString(row.workClass, `records[${index}].workClass`, 255),
    proposedUse: optionalString(row.proposedUse, `records[${index}].proposedUse`, 255),
    occupancyType: optionalString(row.occupancyType, `records[${index}].occupancyType`, 255),
    status: optionalString(row.status, `records[${index}].status`, 100),
    description: requiredString(row.description, `records[${index}].description`, 10_000),
    projectName: optionalString(row.projectName, `records[${index}].projectName`, 500),
    location: {
      address: optionalString(location.address, `records[${index}].location.address`, 1_000),
      city: optionalString(location.city, `records[${index}].location.city`, 100),
      state: optionalString(location.state, `records[${index}].location.state`, 50),
      postalCode: optionalString(location.postalCode, `records[${index}].location.postalCode`, 20),
      parcelId: optionalString(location.parcelId, `records[${index}].location.parcelId`, 255),
      latitude: optionalNumber(location.latitude, `records[${index}].location.latitude`),
      longitude: optionalNumber(location.longitude, `records[${index}].location.longitude`),
    },
    parties: {
      applicant: optionalString(parties.applicant, `records[${index}].parties.applicant`, 500),
      owner: optionalString(parties.owner, `records[${index}].parties.owner`, 500),
      developer: optionalString(parties.developer, `records[${index}].parties.developer`, 500),
      contractor: optionalString(parties.contractor, `records[${index}].parties.contractor`, 500),
      architect: optionalString(parties.architect, `records[${index}].parties.architect`, 500),
      engineer: optionalString(parties.engineer, `records[${index}].parties.engineer`, 500),
    },
    dates: {
      filedAt: isoDate(dates.filedAt, `records[${index}].dates.filedAt`),
      statusUpdatedAt: isoDate(dates.statusUpdatedAt, `records[${index}].dates.statusUpdatedAt`),
      approvedAt: isoDate(dates.approvedAt, `records[${index}].dates.approvedAt`),
      issuedAt: isoDate(dates.issuedAt, `records[${index}].dates.issuedAt`),
      completedAt: isoDate(dates.completedAt, `records[${index}].dates.completedAt`),
    },
    evidence: {
      recordUrl: requiredString(evidence.recordUrl, `records[${index}].evidence.recordUrl`, 2_000),
      pageUrl: optionalString(evidence.pageUrl, `records[${index}].evidence.pageUrl`, 2_000),
      excerpt: requiredString(evidence.excerpt, `records[${index}].evidence.excerpt`, 2_000),
      publishedAt: isoDate(evidence.publishedAt, `records[${index}].evidence.publishedAt`),
      accessedAt: isoDate(evidence.accessedAt, `records[${index}].evidence.accessedAt`, true)!,
    },
    confidence,
    attributes,
  };
}

export function parseNationwideIngestionBatch(value: unknown): NationwideIngestionBatch {
  const body = objectValue(value, "request body");
  const source = objectValue(body.source, "source");
  const version = requiredString(body.version, "version", 20);
  const records = body.records;

  if (version !== INGESTION_BRIDGE_VERSION) {
    throw new IngestionBridgeValidationError(
      `Unsupported contract version. Expected ${INGESTION_BRIDGE_VERSION}.`
    );
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new IngestionBridgeValidationError("records must contain at least one record.");
  }
  if (records.length > MAX_BATCH_RECORDS) {
    throw new IngestionBridgeValidationError(`records cannot exceed ${MAX_BATCH_RECORDS} items.`);
  }

  const parsedRecords = records.map(parseRecord);
  const marketIds = new Set(parsedRecords.map((record) => record.marketId));
  if (marketIds.size !== 1) {
    throw new IngestionBridgeValidationError(
      "records in one batch must share the same marketId."
    );
  }

  return {
    version: INGESTION_BRIDGE_VERSION,
    batchId: requiredString(body.batchId, "batchId", 255),
    generatedAt: isoDate(body.generatedAt, "generatedAt", true)!,
    source: {
      key: requiredString(source.key, "source.key", 100),
      name: requiredString(source.name, "source.name", 255),
      jurisdiction: optionalString(source.jurisdiction, "source.jurisdiction", 255),
      sourceUrl: requiredString(source.sourceUrl, "source.sourceUrl", 2_000),
    },
    records: parsedRecords,
  };
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)}`;
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function configuredBridgeSecret() {
  return process.env.INGESTION_BRIDGE_SECRET?.trim() ?? "";
}

export function isAuthorizedIngestionBridgeRequest(request: Request) {
  const expectedSecret = configuredBridgeSecret();
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!expectedSecret || !suppliedSecret) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const supplied = Buffer.from(suppliedSecret);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function rawRecord(batch: NationwideIngestionBatch, record: NationwideIngestionRecord) {
  return {
    importContract: {
      version: batch.version,
      batchId: batch.batchId,
      sourceKey: batch.source.key,
      generatedAt: batch.generatedAt,
    },
    ...record,
  };
}

export async function importNationwideIngestionBatch(
  batch: NationwideIngestionBatch
): Promise<NationwideImportResult> {
  const latestAccessedAt = [...batch.records]
    .map((record) => record.evidence.accessedAt)
    .sort()
    .at(-1)!;
  const publishedDates = batch.records
    .map((record) => record.evidence.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const marketId = batch.records[0].marketId;
  const sourceDocumentId = stableId("nationwide-source", batch.source.key, marketId);

  await upsertSourceDocument({
    id: sourceDocumentId,
    marketId,
    sourceName: batch.source.name,
    sourceUrl: batch.source.sourceUrl,
    documentUrl: batch.source.sourceUrl,
    reportLabel: `${batch.source.name} nationwide import`,
    publishedAt: publishedDates.at(-1) ?? null,
    accessedAt: latestAccessedAt,
    checksum: contentHash(batch),
    metadata: {
      contractVersion: batch.version,
      batchId: batch.batchId,
      sourceKey: batch.source.key,
      jurisdiction: batch.source.jurisdiction,
      generatedAt: batch.generatedAt,
      recordCount: batch.records.length,
    },
  });

  const runId = await startIngestionRun({
    sourceDocumentId,
    marketId,
    metadata: {
      contractVersion: batch.version,
      batchId: batch.batchId,
      sourceKey: batch.source.key,
    },
  });
  let inserted = 0;
  let updated = 0;

  try {
    for (const record of batch.records) {
      const raw = rawRecord(batch, record);
      const result = await upsertPermitRecord({
        id: stableId("nationwide-record", batch.source.key, record.externalRecordId),
        sourceDocumentId,
        marketId: record.marketId,
        jurisdiction: record.jurisdiction,
        permitNumber: `${batch.source.key}:${record.externalRecordId}`,
        permitType: record.permitType,
        permitSubtype: record.permitSubtype ?? record.workClass,
        status: record.status ?? record.approvalStage,
        appliedDate: record.dates?.filedAt ?? null,
        issuedDate: record.dates?.issuedAt ?? null,
        finaledDate: record.dates?.completedAt ?? null,
        address: record.location?.address ?? null,
        city: record.location?.city ?? null,
        parcelNumber: record.location?.parcelId ?? null,
        applicant: record.parties?.applicant ?? record.parties?.developer ?? null,
        contractor: record.parties?.contractor ?? null,
        valuation:
          typeof record.attributes?.valuation === "number" ? record.attributes.valuation : null,
        description: record.description,
        raw,
        contentHash: contentHash(raw),
      });

      if (result.action === "inserted") inserted += 1;
      else updated += 1;
    }

    await finishIngestionRun({
      id: runId,
      status: "succeeded",
      recordsFound: batch.records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      metadata: { batchId: batch.batchId, sourceKey: batch.source.key },
    });
  } catch (error) {
    await finishIngestionRun({
      id: runId,
      status: "failed",
      recordsFound: batch.records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      errorMessage: error instanceof Error ? error.message : "Unknown import failure",
      metadata: { batchId: batch.batchId, sourceKey: batch.source.key },
    });
    throw error;
  }

  return {
    batchId: batch.batchId,
    runId,
    sourceKey: batch.source.key,
    recordsFound: batch.records.length,
    recordsInserted: inserted,
    recordsUpdated: updated,
  };
}
