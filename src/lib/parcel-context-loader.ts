import { getSeededParcelContext } from "@/data/parcel-context";
import { loadLiveCountyParcelContext } from "@/lib/parcel-loaders/live-county-loader";
import { loadManualParcelContext } from "@/lib/parcel-loaders/manual-import-loader";
import type { ParcelContext, PermitSignal } from "@/types/domain";

type ParcelContextLoader = (signal: PermitSignal) => ParcelContext | null;

function loadSeededParcelContext(signal: PermitSignal): ParcelContext | null {
  return getSeededParcelContext(signal.siteApn);
}

function mergeNotes(...notes: string[][]): string[] {
  return [...new Set(notes.flat().filter(Boolean))];
}

function mergeSourceLabel(primary: ParcelContext, secondary: ParcelContext): string {
  if (primary.sourceLabel === secondary.sourceLabel) {
    return primary.sourceLabel;
  }

  return `${primary.sourceLabel} + ${secondary.sourceLabel}`;
}

function mergeSourceAsOf(primary: ParcelContext, secondary: ParcelContext): string {
  return primary.sourceAsOf >= secondary.sourceAsOf ? primary.sourceAsOf : secondary.sourceAsOf;
}

function mergeStatus(primary: ParcelContext, secondary: ParcelContext): ParcelContext["status"] {
  if (primary.status === "missing" && secondary.status === "missing") {
    return "missing";
  }

  return "partial";
}

function mergeParcelContexts(primary: ParcelContext, secondary: ParcelContext): ParcelContext {
  return {
    apn: primary.apn,
    status: mergeStatus(primary, secondary),
    sourceLabel: mergeSourceLabel(primary, secondary),
    sourceAsOf: mergeSourceAsOf(primary, secondary),
    ownerName: primary.ownerName ?? secondary.ownerName,
    ownershipEntityType:
      primary.ownershipEntityType !== "unknown"
        ? primary.ownershipEntityType
        : secondary.ownershipEntityType,
    ownerMailingCity: primary.ownerMailingCity ?? secondary.ownerMailingCity,
    zoning: primary.zoning ?? secondary.zoning,
    landUse: primary.landUse ?? secondary.landUse,
    lotSizeAcres: primary.lotSizeAcres ?? secondary.lotSizeAcres,
    lastTransferDate: primary.lastTransferDate ?? secondary.lastTransferDate,
    transferContext: primary.transferContext ?? secondary.transferContext,
    assessedValue: primary.assessedValue ?? secondary.assessedValue,
    contextNotes: mergeNotes(primary.contextNotes, secondary.contextNotes),
  };
}

function buildMissingParcelContext(signal: PermitSignal): ParcelContext {
  return {
    apn: signal.siteApn,
    status: "missing",
    sourceLabel: "Parcel context not yet loaded",
    sourceAsOf: signal.appliedDate,
    ownerName: null,
    ownershipEntityType: "unknown",
    ownerMailingCity: null,
    zoning: null,
    landUse: null,
    lotSizeAcres: null,
    lastTransferDate: null,
    transferContext: null,
    assessedValue: null,
    contextNotes: [
      "Live county parcel enrichment did not return data for this APN yet.",
      "Manual and seeded parcel context also did not return a usable record.",
      "The permit record still supports a feed item, but APN-level diligence remains open.",
    ],
  };
}

const parcelContextLoaders: ParcelContextLoader[] = [
  loadLiveCountyParcelContext,
  loadManualParcelContext,
  loadSeededParcelContext,
];

export function loadParcelContext(signal: PermitSignal): ParcelContext {
  let resolvedContext: ParcelContext | null = null;

  for (const loader of parcelContextLoaders) {
    const context = loader(signal);

    if (context) {
      resolvedContext = resolvedContext
        ? mergeParcelContexts(resolvedContext, context)
        : context;
    }
  }

  return resolvedContext ?? buildMissingParcelContext(signal);
}

export const __testing = {
  mergeParcelContexts,
  buildMissingParcelContext,
};
