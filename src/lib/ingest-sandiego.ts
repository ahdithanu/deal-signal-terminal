import { createHash, randomUUID } from "node:crypto";

import { sanDiegoDevelopmentMarket } from "@/data/markets";
import {
  finishIngestionRun,
  startIngestionRun,
  upsertPermitRecord,
  upsertSourceDocument,
} from "@/lib/ingestion-store";

export type SanDiegoIngestionResult = {
  runId: string;
  sourceDocumentId: string;
  marketId: string;
  recordsScanned: number;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
};

type SanDiegoApprovalRow = {
  DEVELOPMENT_ID?: string;
  PROJECT_ID?: string;
  PROJECT_TYPE?: string;
  PROJECT_TITLE?: string;
  PROJECT_SCOPE?: string;
  GIS_ADDRESS?: string;
  GIS_APN?: string;
  APPROVAL_ID?: string;
  APPROVAL_TYPE?: string;
  APPROVAL_STATUS?: string;
  APPROVAL_SCOPE?: string;
  APPROVAL_CREATE_DATE?: string;
  APPROVAL_ISSUE_DATE?: string;
  APPROVAL_CLOSE_DATE?: string;
  APPROVAL_VALUATION?: string;
  APPROVAL_DU_NET_CHANGE?: string;
  APPROVAL_FLOOR_AREA?: string;
  APPROVAL_PERMIT_HOLDER?: string;
};

const MAX_RECORDS_TO_STORE = 50;
const DEVELOPMENT_KEYWORDS = [
  "building",
  "construction",
  "grading",
  "right of way",
  "site development",
  "planned development",
  "neighborhood development",
  "coastal development",
  "rezone",
  "map",
  "subdivision",
  "public improvement",
];

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeDate(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function parseNumber(value: string | undefined) {
  const normalized = value?.replace(/,/g, "").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceDocumentId() {
  return `source-${sanDiegoDevelopmentMarket.id}-2026-issued-approvals`;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

export function parseSanDiegoApprovalsCsv(csv: string): SanDiegoApprovalRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = parseCsvLine(lines[0] ?? "");

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function isDevelopmentSignal(row: SanDiegoApprovalRow) {
  const searchable = `${row.APPROVAL_TYPE ?? ""} ${row.APPROVAL_SCOPE ?? ""} ${
    row.PROJECT_SCOPE ?? ""
  }`.toLowerCase();
  const valuation = parseNumber(row.APPROVAL_VALUATION);
  const unitChange = parseNumber(row.APPROVAL_DU_NET_CHANGE);
  const floorArea = parseNumber(row.APPROVAL_FLOOR_AREA);

  return (
    DEVELOPMENT_KEYWORDS.some((keyword) => searchable.includes(keyword)) ||
    (valuation ?? 0) >= 500_000 ||
    Math.abs(unitChange ?? 0) >= 2 ||
    (floorArea ?? 0) >= 10_000
  );
}

function rankSignal(row: SanDiegoApprovalRow) {
  const valuation = parseNumber(row.APPROVAL_VALUATION) ?? 0;
  const unitChange = Math.abs(parseNumber(row.APPROVAL_DU_NET_CHANGE) ?? 0);
  const floorArea = parseNumber(row.APPROVAL_FLOOR_AREA) ?? 0;
  const searchable = `${row.APPROVAL_TYPE ?? ""} ${row.APPROVAL_SCOPE ?? ""}`.toLowerCase();
  let score = 0;

  if (valuation >= 1_000_000) score += 4;
  if (valuation >= 5_000_000) score += 3;
  if (unitChange >= 2) score += 3;
  if (unitChange >= 10) score += 3;
  if (floorArea >= 10_000) score += 2;
  if (/grading|right of way|site development|map|rezone|coastal development/.test(searchable)) {
    score += 3;
  }
  if (/construction change|deferred document|encroachment agreement/.test(searchable)) {
    score -= 2;
  }

  return score;
}

async function fetchSanDiegoApprovalsCsv() {
  const response = await fetch(sanDiegoDevelopmentMarket.sourceDocumentUrl, {
    headers: {
      "User-Agent": "Build Signals ingestion/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`San Diego source returned ${response.status}`);
  }

  return response.text();
}

export async function ingestSanDiegoDevelopmentApprovals(): Promise<SanDiegoIngestionResult> {
  const csv = await fetchSanDiegoApprovalsCsv();
  const rows = parseSanDiegoApprovalsCsv(csv);
  const sourceId = sourceDocumentId();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const selectedRows = rows
    .filter((row) => row.APPROVAL_ID && row.APPROVAL_ISSUE_DATE && isDevelopmentSignal(row))
    .sort((left, right) => rankSignal(right) - rankSignal(left))
    .slice(0, MAX_RECORDS_TO_STORE);
  let inserted = 0;
  let updated = 0;

  try {
    await upsertSourceDocument({
      id: sourceId,
      marketId: sanDiegoDevelopmentMarket.id,
      sourceName: "City of San Diego Open Data",
      sourceUrl: sanDiegoDevelopmentMarket.sourcePageUrl,
      documentUrl: sanDiegoDevelopmentMarket.sourceDocumentUrl,
      reportLabel: sanDiegoDevelopmentMarket.reportLabel,
      reportingPeriodStart: sanDiegoDevelopmentMarket.sourceWindow.start,
      reportingPeriodEnd: sanDiegoDevelopmentMarket.sourceWindow.end,
      accessedAt: startedAt,
      checksum: stableHash(csv),
      metadata: {
        sourceType: "development_approvals_csv",
        rowsScanned: rows.length,
        rowsStored: selectedRows.length,
        filter: "development_signal_top_records",
      },
    });
    await startIngestionRun({
      id: runId,
      sourceDocumentId: sourceId,
      marketId: sanDiegoDevelopmentMarket.id,
      startedAt,
      metadata: {
        reportLabel: sanDiegoDevelopmentMarket.reportLabel,
        sourceDocumentUrl: sanDiegoDevelopmentMarket.sourceDocumentUrl,
        recordsScanned: rows.length,
      },
    });

    for (const row of selectedRows) {
      const raw = { ...row, signalRankScore: rankSignal(row) };
      const result = await upsertPermitRecord({
        id: `permit-record-${sanDiegoDevelopmentMarket.id}-${row.APPROVAL_ID}`,
        sourceDocumentId: sourceId,
        marketId: sanDiegoDevelopmentMarket.id,
        jurisdiction: "City of San Diego",
        permitNumber: row.APPROVAL_ID ?? "",
        permitType: row.APPROVAL_TYPE ?? "Development approval",
        permitSubtype: row.APPROVAL_SCOPE ?? row.PROJECT_TYPE ?? null,
        status: row.APPROVAL_STATUS ?? null,
        appliedDate: normalizeDate(row.APPROVAL_CREATE_DATE),
        issuedDate: normalizeDate(row.APPROVAL_ISSUE_DATE),
        finaledDate: normalizeDate(row.APPROVAL_CLOSE_DATE),
        address: row.GIS_ADDRESS?.trim() || null,
        city: "SAN DIEGO",
        parcelNumber: row.GIS_APN?.trim() || null,
        applicant: row.APPROVAL_PERMIT_HOLDER?.trim() || null,
        valuation: parseNumber(row.APPROVAL_VALUATION),
        description: row.APPROVAL_SCOPE || row.PROJECT_SCOPE || row.PROJECT_TITLE || "",
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
      recordsFound: selectedRows.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      metadata: {
        sourceDocumentId: sourceId,
        recordsScanned: rows.length,
      },
    });

    return {
      runId,
      sourceDocumentId: sourceId,
      marketId: sanDiegoDevelopmentMarket.id,
      recordsScanned: rows.length,
      recordsFound: selectedRows.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
    };
  } catch (error) {
    await finishIngestionRun({
      id: runId,
      status: "failed",
      recordsFound: selectedRows.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      errorMessage: error instanceof Error ? error.message : "Unknown ingestion error",
      metadata: {
        sourceDocumentId: sourceId,
        recordsScanned: rows.length,
      },
    }).catch(() => undefined);

    throw error;
  }
}
