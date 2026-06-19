import "server-only";

import { opportunitySourceBatches, type OpportunitySourceBatch } from "@/data/opportunity-sources";
import { buildGeneratedOpportunitySourceBatches } from "@/lib/generated-opportunity-sources";
import {
  buildOpportunitiesFromBatches,
  opportunities,
  shouldSurfaceInHomeFeed,
} from "@/lib/opportunities";
import type { Opportunity, PermitSignal } from "@/types/domain";

export type GeneratedOpportunityHealthMarket = {
  marketId: string;
  generatedSignals: number;
  generatedSeeds: number;
  generatedOpportunities: number;
  surfacedOpportunities: number;
  topOpportunity: {
    slug: string;
    title: string;
    priorityScore: number;
    priorityBand: string;
  } | null;
};

function permitKey(signal: PermitSignal) {
  return `${signal.marketId}:${signal.permitNumber}`;
}

function withoutCuratedPermitDuplicates(generatedBatches: OpportunitySourceBatch[]) {
  const curatedPermitKeys = new Set(
    opportunitySourceBatches.flatMap((batch) => batch.signals.map(permitKey))
  );

  return generatedBatches
    .map((batch) => {
      const signals = batch.signals.filter((signal) => !curatedPermitKeys.has(permitKey(signal)));
      const signalIds = new Set(signals.map((signal) => signal.id));
      const seeds = batch.seeds.filter((seed) =>
        seed.signalIds.some((signalId) => signalIds.has(signalId))
      );

      return {
        ...batch,
        seeds,
        signals,
      };
    })
    .filter((batch) => batch.seeds.length > 0 && batch.signals.length > 0);
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const generatedBatches = withoutCuratedPermitDuplicates(
    await buildGeneratedOpportunitySourceBatches()
  );

  if (generatedBatches.length === 0) {
    return opportunities;
  }

  return buildOpportunitiesFromBatches([...opportunitySourceBatches, ...generatedBatches]);
}

export async function getHomeFeedOpportunities(): Promise<Opportunity[]> {
  const liveOpportunities = await getOpportunities();

  return liveOpportunities.filter(shouldSurfaceInHomeFeed);
}

export async function getOpportunityBySlugWithGenerated(
  slug: string
): Promise<Opportunity | undefined> {
  const liveOpportunities = await getOpportunities();

  return liveOpportunities.find((opportunity) => opportunity.slug === slug);
}

export async function listGeneratedOpportunityHealth(): Promise<GeneratedOpportunityHealthMarket[]> {
  const generatedBatches = withoutCuratedPermitDuplicates(
    await buildGeneratedOpportunitySourceBatches()
  );

  if (generatedBatches.length === 0) {
    return [];
  }

  const generatedOpportunities = buildOpportunitiesFromBatches(generatedBatches);

  return generatedBatches
    .map((batch) => {
      const marketOpportunities = generatedOpportunities.filter(
        (opportunity) => opportunity.marketId === batch.market.id
      );
      const surfacedOpportunities = marketOpportunities.filter(shouldSurfaceInHomeFeed);
      const topOpportunity = marketOpportunities[0];

      return {
        marketId: batch.market.id,
        generatedSignals: batch.signals.length,
        generatedSeeds: batch.seeds.length,
        generatedOpportunities: marketOpportunities.length,
        surfacedOpportunities: surfacedOpportunities.length,
        topOpportunity: topOpportunity
          ? {
              slug: topOpportunity.slug,
              title: topOpportunity.projectName ?? topOpportunity.title,
              priorityScore: topOpportunity.priorityScore,
              priorityBand: topOpportunity.priorityBand,
            }
          : null,
      };
    })
    .sort((left, right) => right.generatedOpportunities - left.generatedOpportunities);
}
