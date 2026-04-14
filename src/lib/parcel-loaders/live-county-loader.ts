import countyParcelContext from "@/data/parcel-context-county.json";
import type { ParcelContext, PermitSignal } from "@/types/domain";

type CountyParcelRecord = {
  zoning: string | null;
  landUse: string | null;
  lotSizeAcres: number | null;
  contextNotes: string[];
};

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function normalizeCountyRecord(value: unknown): CountyParcelRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const contextNotes = Array.isArray(record.contextNotes)
    ? record.contextNotes.filter((note): note is string => typeof note === "string")
    : [];

  if (
    !isStringOrNull(record.zoning) ||
    !isStringOrNull(record.landUse) ||
    !isNumberOrNull(record.lotSizeAcres)
  ) {
    return null;
  }

  return {
    zoning: record.zoning,
    landUse: record.landUse,
    lotSizeAcres: record.lotSizeAcres,
    contextNotes,
  };
}

const countyParcelContextByApn = Object.fromEntries(
  Object.entries(countyParcelContext).flatMap(([apn, value]) => {
    const normalized = normalizeCountyRecord(value);
    return normalized ? [[apn, normalized]] : [];
  })
) as Record<string, CountyParcelRecord>;

export function loadLiveCountyParcelContext(signal: PermitSignal): ParcelContext | null {
  const record = countyParcelContextByApn[signal.siteApn];

  if (!record) {
    return null;
  }

  return {
    apn: signal.siteApn,
    status: "partial",
    sourceLabel: "El Dorado County parcel facts extract",
    sourceAsOf: "2026-04-06",
    ownerName: null,
    ownershipEntityType: "unknown",
    ownerMailingCity: null,
    zoning: record.zoning,
    landUse: record.landUse,
    lotSizeAcres: record.lotSizeAcres,
    lastTransferDate: null,
    transferContext: null,
    assessedValue: null,
    contextNotes: record.contextNotes,
  };
}
