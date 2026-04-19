import { describe, expect, it } from "vitest";

import { markets } from "@/data/markets";
import { opportunitySeeds, rawPermitSignals } from "@/data/eldorado-west-slope";
import { classifyOpportunity, scoreOpportunity } from "@/lib/scoring";

function getSeed(id: string) {
  const seed = opportunitySeeds.find((candidate) => candidate.id === id);

  if (!seed) {
    throw new Error(`Missing seed ${id}`);
  }

  return seed;
}

function getSignals(signalIds: string[]) {
  return signalIds.map((id) => {
    const signal = rawPermitSignals.find((candidate) => candidate.id === id);

    if (!signal) {
      throw new Error(`Missing signal ${id}`);
    }

    return signal;
  });
}

describe("scoring", () => {
  it("classifies disaster signals as distress", () => {
    const seed = getSeed("air-park-self-storage-fire");
    const signals = getSignals(seed.signalIds);

    expect(classifyOpportunity(seed, signals)).toBe("distress");
  });

  it("prioritizes large development staging signals above weak maintenance", () => {
    const developmentSeed = getSeed("quantum-care-sales-office-trailer");
    const maintenanceSeed = getSeed("plaza-goldorado-hvac-replacement");
    const developmentScore = scoreOpportunity(
      developmentSeed,
      getSignals(developmentSeed.signalIds),
      markets["ca-eldorado-west-slope"]
    );
    const maintenanceScore = scoreOpportunity(
      maintenanceSeed,
      getSignals(maintenanceSeed.signalIds),
      markets["ca-eldorado-west-slope"]
    );

    expect(developmentScore.priorityScore).toBeGreaterThan(maintenanceScore.priorityScore);
    expect(developmentScore.confidenceLevel).not.toBe("low");
    expect(maintenanceScore.confidenceLevel).toBe("low");
  });
});
