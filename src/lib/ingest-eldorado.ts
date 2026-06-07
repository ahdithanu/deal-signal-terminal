import { createHash, randomUUID } from "node:crypto";

import { rawPermitSignals } from "@/data/eldorado-west-slope";
import { elDoradoWestSlopeMarket } from "@/data/markets";
import {
  finishIngestionRun,
  startIngestionRun,
  upsertPermitRecord,
  upsertSourceDocument,
} from "@/lib/ingestion-store";
import type { PermitSignal } from "@/types/domain";

export type ElDoradoIngestionResult = {
  runId: string;
  sourceDocumentId: string;
  marketId: string;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourceDocumentId() {
  return [
    "source",
    elDoradoWestSlopeMarket.id,
    elDoradoWestSlopeMarket.sourceWindow.start,
    elDoradoWestSlopeMarket.sourceWindow.end,
  ].join("-");
}

function rawSignalPayload(signal: PermitSignal) {
  return {
    id: signal.id,
    permitNumber: signal.permitNumber,
    marketId: signal.marketId,
    jurisdiction: signal.jurisdiction,
    permitType: signal.permitType,
    permitSubtype: signal.permitSubtype,
    description: signal.description,
    status: signal.status,
    appliedDate: signal.appliedDate,
    approvedDate: signal.approvedDate ?? null,
    issuedDate: signal.issuedDate ?? null,
    finalizedDate: signal.finalizedDate ?? null,
    contractorName: signal.contractorName ?? null,
    projectName: signal.projectName ?? null,
    siteAddress: signal.siteAddress,
    siteApn: signal.siteApn,
    siteCity: signal.siteCity,
    source: signal.source,
  };
}

export async function ingestElDoradoPermitSignals(): Promise<ElDoradoIngestionResult> {
  const sourceId = sourceDocumentId();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  try {
    await upsertSourceDocument({
      id: sourceId,
      marketId: elDoradoWestSlopeMarket.id,
      sourceName: "El Dorado County Building Division",
      sourceUrl: elDoradoWestSlopeMarket.sourcePageUrl,
      documentUrl: elDoradoWestSlopeMarket.sourceDocumentUrl,
      reportLabel: elDoradoWestSlopeMarket.reportLabel,
      reportingPeriodStart: elDoradoWestSlopeMarket.sourceWindow.start,
      reportingPeriodEnd: elDoradoWestSlopeMarket.sourceWindow.end,
      publishedAt: rawPermitSignals[0]?.source.publishedAt ?? null,
      accessedAt: rawPermitSignals[0]?.source.accessedAt ?? startedAt,
      checksum: stableHash(rawPermitSignals),
      metadata: {
        sourceType: "permit_activity_report",
        input: "curated_normalized_seed",
        recordsScanned: elDoradoWestSlopeMarket.recordsScanned,
      },
    });
    await startIngestionRun({
      id: runId,
      sourceDocumentId: sourceId,
      marketId: elDoradoWestSlopeMarket.id,
      startedAt,
      metadata: {
        reportLabel: elDoradoWestSlopeMarket.reportLabel,
        sourceDocumentUrl: elDoradoWestSlopeMarket.sourceDocumentUrl,
      },
    });

    for (const signal of rawPermitSignals) {
      const raw = rawSignalPayload(signal);
      const result = await upsertPermitRecord({
        id: `permit-record-${signal.marketId}-${signal.permitNumber}`,
        sourceDocumentId: sourceId,
        marketId: signal.marketId,
        jurisdiction: signal.jurisdiction,
        permitNumber: signal.permitNumber,
        permitType: signal.permitType,
        permitSubtype: signal.permitSubtype,
        status: signal.status,
        appliedDate: signal.appliedDate,
        issuedDate: signal.issuedDate ?? null,
        finaledDate: signal.finalizedDate ?? null,
        address: signal.siteAddress,
        city: signal.siteCity,
        parcelNumber: signal.siteApn,
        contractor: signal.contractorName ?? null,
        description: signal.description,
        raw,
        contentHash: stableHash(raw),
      });

      if (result.action === "inserted") {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    await finishIngestionRun({
      id: runId,
      status: "succeeded",
      recordsFound: rawPermitSignals.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      metadata: {
        sourceDocumentId: sourceId,
      },
    });

    return {
      runId,
      sourceDocumentId: sourceId,
      marketId: elDoradoWestSlopeMarket.id,
      recordsFound: rawPermitSignals.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
    };
  } catch (error) {
    await finishIngestionRun({
      id: runId,
      status: "failed",
      recordsFound: rawPermitSignals.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      errorMessage: error instanceof Error ? error.message : "Unknown ingestion error",
      metadata: {
        sourceDocumentId: sourceId,
      },
    }).catch(() => undefined);

    throw error;
  }
}
