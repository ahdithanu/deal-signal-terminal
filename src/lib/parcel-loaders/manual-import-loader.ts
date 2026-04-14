import manualParcelContext from "@/data/parcel-context-manual.json";
import type { ParcelContext, PermitSignal } from "@/types/domain";

type ManualParcelContextRecord = Omit<ParcelContext, "apn">;

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function normalizeManualRecord(value: unknown): ManualParcelContextRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const contextNotes = Array.isArray(record.contextNotes)
    ? record.contextNotes.filter((note): note is string => typeof note === "string")
    : [];

  if (
    (record.status !== "seeded" && record.status !== "partial" && record.status !== "missing") ||
    typeof record.sourceLabel !== "string" ||
    typeof record.sourceAsOf !== "string" ||
    !isStringOrNull(record.ownerName) ||
    (record.ownershipEntityType !== "individual" &&
      record.ownershipEntityType !== "entity" &&
      record.ownershipEntityType !== "public" &&
      record.ownershipEntityType !== "unknown") ||
    !isStringOrNull(record.ownerMailingCity) ||
    !isStringOrNull(record.zoning) ||
    !isStringOrNull(record.landUse) ||
    !isNumberOrNull(record.lotSizeAcres) ||
    !isStringOrNull(record.lastTransferDate) ||
    !isStringOrNull(record.transferContext) ||
    !isNumberOrNull(record.assessedValue)
  ) {
    return null;
  }

  return {
    status: record.status,
    sourceLabel: record.sourceLabel,
    sourceAsOf: record.sourceAsOf,
    ownerName: record.ownerName,
    ownershipEntityType: record.ownershipEntityType,
    ownerMailingCity: record.ownerMailingCity,
    zoning: record.zoning,
    landUse: record.landUse,
    lotSizeAcres: record.lotSizeAcres,
    lastTransferDate: record.lastTransferDate,
    transferContext: record.transferContext,
    assessedValue: record.assessedValue,
    contextNotes,
  };
}

const manualParcelContextByApn = Object.fromEntries(
  Object.entries(manualParcelContext).flatMap(([apn, value]) => {
    const normalized = normalizeManualRecord(value);
    return normalized ? [[apn, normalized]] : [];
  })
) as Record<string, ManualParcelContextRecord>;

export function loadManualParcelContext(signal: PermitSignal): ParcelContext | null {
  const record = manualParcelContextByApn[signal.siteApn];

  if (!record) {
    return null;
  }

  return {
    apn: signal.siteApn,
    ...record,
  };
}
