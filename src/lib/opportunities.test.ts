import { describe, expect, it } from "vitest";

import { homeFeedOpportunities, opportunities } from "@/lib/opportunities";

describe("opportunities", () => {
  it("derives ranked opportunities from each active market", () => {
    const marketIds = new Set(opportunities.map((opportunity) => opportunity.marketId));

    expect(marketIds).toContain("ca-eldorado-west-slope");
    expect(marketIds).toContain("ca-san-diego-development");
    expect(opportunities.length).toBeGreaterThan(13);
  });

  it("surfaces sourced San Diego opportunities in the home feed", () => {
    const sanDiegoOpportunities = homeFeedOpportunities.filter(
      (opportunity) => opportunity.marketId === "ca-san-diego-development"
    );

    expect(sanDiegoOpportunities.length).toBeGreaterThan(0);
    expect(sanDiegoOpportunities[0]?.evidence[0]?.pageUrl).toBe(
      "https://data.sandiego.gov/datasets/development-permits/"
    );
    expect(sanDiegoOpportunities[0]?.missingFacts.length).toBeGreaterThan(0);
  });
});
