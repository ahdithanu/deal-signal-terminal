import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { opportunities } from "@/lib/opportunities";

const TEST_DB_PATH = `${process.cwd()}/.data/test-research-agents.db`;

describe("multi-agent research", () => {
  beforeEach(async () => {
    process.env.BUILD_SIGNALS_DB_PROVIDER = "sqlite";
    process.env.BUILD_SIGNALS_DB_PATH = TEST_DB_PATH;
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
  });

  afterEach(async () => {
    const db = await import("@/lib/db");
    db.resetDatabaseForTests();
    delete process.env.BUILD_SIGNALS_DB_PROVIDER;
    delete process.env.BUILD_SIGNALS_DB_PATH;
  });

  function getOpportunity() {
    const opportunity = opportunities[0];

    if (!opportunity) {
      throw new Error("Expected seeded opportunity fixture.");
    }

    return opportunity;
  }

  it("validates each agent structured output schema", async () => {
    const {
      companyAgent,
      marketAgent,
      memoAgent,
      permitAgent,
      propertyAgent,
      riskAgent,
    } = await import("@/lib/research-agents");
    const opportunity = getOpportunity();
    const permit = await permitAgent.execute({ opportunity });
    const property = await propertyAgent.execute({ opportunity });
    const company = await companyAgent.execute({ opportunity });
    const risk = await riskAgent.execute({ opportunity, permit, property, company });
    const market = await marketAgent.execute({ opportunity });
    const memo = await memoAgent.execute({
      opportunity,
      specialistOutputs: [permit, property, company, risk, market],
    });

    expect(permitAgent.validateOutput(permit)).toBe(true);
    expect(propertyAgent.validateOutput(property)).toBe(true);
    expect(companyAgent.validateOutput(company)).toBe(true);
    expect(riskAgent.validateOutput(risk)).toBe(true);
    expect(marketAgent.validateOutput(market)).toBe(true);
    expect(memoAgent.validateOutput(memo)).toBe(true);
    expect(permit.citations.length).toBeGreaterThan(0);
    expect(memo.memo).toContain("Executive read");
  });

  it("coordinates specialist agents into a persisted research packet", async () => {
    const { runMultiAgentResearch } = await import("@/lib/research-agents");
    const { getLatestResearchPacketForOpportunity } = await import("@/lib/research-store");
    const opportunity = getOpportunity();

    const packet = await runMultiAgentResearch({ opportunity });
    const persisted = await getLatestResearchPacketForOpportunity(opportunity.id);

    expect(packet.status).toBe("succeeded");
    expect(packet.outputs.map((output) => output.agentName)).toEqual([
      "permit",
      "property",
      "company",
      "risk",
      "market",
      "memo",
      "coordinator",
    ]);
    expect(packet.finalOutput.finalMemo).toContain("Executive read");
    expect(packet.finalOutput.citations.length).toBeGreaterThan(0);
    expect(persisted?.runId).toBe(packet.runId);
    expect(persisted?.outputs).toHaveLength(7);
  });

  it("recovers when a specialist agent fails", async () => {
    const { runMultiAgentResearch } = await import("@/lib/research-agents");
    const opportunity = getOpportunity();

    const packet = await runMultiAgentResearch(
      { opportunity },
      { forceAgentFailure: "company" }
    );
    const company = packet.outputs.find((output) => output.agentName === "company");

    expect(packet.status).toBe("failed");
    expect(company?.status).toBe("failed");
    expect(packet.finalOutput.finalMemo).toContain("Executive read");
    expect(packet.finalOutput.summary).toContain("partial research");
  });

  it("rejects invalid structured outputs", async () => {
    const { permitAgent } = await import("@/lib/research-agents");

    expect(permitAgent.validateOutput({ agentName: "permit" })).toBe(false);
  });
});
