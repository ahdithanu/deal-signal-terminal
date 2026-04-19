import { describe, expect, it } from "vitest";

import type { ParcelContext } from "@/types/domain";
import { __testing } from "@/lib/parcel-context-loader";

describe("parcel context merging", () => {
  it("merges complementary parcel facts across sources", () => {
    const countyContext: ParcelContext = {
      apn: "123-456-789",
      status: "partial",
      sourceLabel: "County",
      sourceAsOf: "2026-04-01",
      ownerName: null,
      ownershipEntityType: "unknown",
      ownerMailingCity: null,
      zoning: "CC",
      landUse: "Commercial",
      lotSizeAcres: 1.2,
      lastTransferDate: null,
      transferContext: null,
      assessedValue: null,
      contextNotes: ["County parcel facts"],
    };

    const manualContext: ParcelContext = {
      apn: "123-456-789",
      status: "partial",
      sourceLabel: "Manual",
      sourceAsOf: "2026-04-05",
      ownerName: "Example Holdings LLC",
      ownershipEntityType: "entity",
      ownerMailingCity: "El Dorado Hills",
      zoning: null,
      landUse: null,
      lotSizeAcres: null,
      lastTransferDate: "2025-11-13",
      transferContext: "Recent transfer",
      assessedValue: 500000,
      contextNotes: ["Manual ownership research"],
    };

    const merged = __testing.mergeParcelContexts(countyContext, manualContext);

    expect(merged.ownerName).toBe("Example Holdings LLC");
    expect(merged.zoning).toBe("CC");
    expect(merged.lastTransferDate).toBe("2025-11-13");
    expect(merged.sourceLabel).toBe("County + Manual");
    expect(merged.sourceAsOf).toBe("2026-04-05");
    expect(merged.contextNotes).toContain("County parcel facts");
    expect(merged.contextNotes).toContain("Manual ownership research");
  });
});
