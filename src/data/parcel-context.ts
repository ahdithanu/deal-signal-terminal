import type { ParcelContext } from "@/types/domain";

const defaultSourceLabel = "Seeded parcel context for v1 architecture";
const defaultSourceAsOf = "2026-04-04";

function buildParcelContext(
  apn: string,
  context: Omit<ParcelContext, "apn" | "sourceLabel" | "sourceAsOf">
): ParcelContext {
  return {
    apn,
    sourceLabel: defaultSourceLabel,
    sourceAsOf: defaultSourceAsOf,
    ...context,
  };
}

export const seededParcelContextByApn: Record<string, ParcelContext> = {
  "083182007": buildParcelContext("083182007", {
    status: "partial",
    ownerName: "Air Park Self Storage LLC",
    ownershipEntityType: "entity",
    ownerMailingCity: "Cameron Park",
    zoning: "Commercial Regional",
    landUse: "Self-storage",
    lotSizeAcres: 4.7,
    lastTransferDate: null,
    transferContext: null,
    assessedValue: null,
    contextNotes: [
      "Ownership entity is seeded for product architecture and should be verified against county parcel records.",
      "Lot size and zoning context are included as diligence scaffolding, not fully verified title data.",
    ],
  }),
  "117490004": buildParcelContext("117490004", {
    status: "seeded",
    ownerName: "Carson Crossing Holdings LLC",
    ownershipEntityType: "entity",
    ownerMailingCity: "El Dorado Hills",
    zoning: "Commercial Mixed Use",
    landUse: "Medical office / mixed-use pad",
    lotSizeAcres: 3.2,
    lastTransferDate: "2022-08-11",
    transferContext: "Sponsor-controlled pad within a larger Carson Crossing development area.",
    assessedValue: 4125000,
    contextNotes: [
      "Parcel context is seeded to model sponsor-controlled development follow-up.",
      "Ownership and assessed value should be replaced with live county assessor data in production.",
    ],
  }),
  "124301027": buildParcelContext("124301027", {
    status: "seeded",
    ownerName: "Green Valley Retail Partners LLC",
    ownershipEntityType: "entity",
    ownerMailingCity: "El Dorado Hills",
    zoning: "Commercial Community",
    landUse: "Neighborhood retail center",
    lotSizeAcres: 2.1,
    lastTransferDate: "2021-05-19",
    transferContext: "Existing center ownership with likely leasing and repositioning optionality.",
    assessedValue: 3650000,
    contextNotes: [
      "Use this as owner/zoning scaffolding for leasing and center repositioning diligence.",
    ],
  }),
  "082552001": buildParcelContext("082552001", {
    status: "partial",
    ownerName: "Wilkinson Ridge Holdings",
    ownershipEntityType: "entity",
    ownerMailingCity: "Cameron Park",
    zoning: "Residential Estate Hillside",
    landUse: "Hillside residential lot",
    lotSizeAcres: 1.4,
    lastTransferDate: "2024-02-09",
    transferContext: "Likely lot repositioning or builder-controlled homesite.",
    assessedValue: 289000,
    contextNotes: [
      "Entity ownership suggests a developer or spec-builder path, but should be verified against live parcel records.",
    ],
  }),
  "046440012": buildParcelContext("046440012", {
    status: "partial",
    ownerName: "La Mesa Land Holdings",
    ownershipEntityType: "entity",
    ownerMailingCity: "Somerset",
    zoning: "Rural residential",
    landUse: "Manufactured home site",
    lotSizeAcres: 1.9,
    lastTransferDate: "2023-11-03",
    transferContext: "Recent low-basis site control consistent with teardown or replacement housing.",
    assessedValue: 214000,
    contextNotes: [
      "Ownership shell and transfer timing are seeded to support teardown-to-redevelopment logic.",
    ],
  }),
  "118181021": buildParcelContext("118181021", {
    status: "partial",
    ownerName: "Blackstone Village Retail Owner",
    ownershipEntityType: "entity",
    ownerMailingCity: "El Dorado Hills",
    zoning: "Commercial Mixed Use",
    landUse: "Retail pavilion",
    lotSizeAcres: 1.1,
    lastTransferDate: null,
    transferContext: null,
    assessedValue: null,
    contextNotes: [
      "This parcel remains in the data layer but is still a weaker feed signal on its own.",
    ],
  }),
};

export function getSeededParcelContext(apn: string): ParcelContext | null {
  return seededParcelContextByApn[apn] ?? null;
}
