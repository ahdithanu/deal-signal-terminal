import { ingestElDoradoPermitSignals } from "@/lib/ingest-eldorado";
import { ingestSanDiegoDevelopmentApprovals } from "@/lib/ingest-sandiego";
import { emitDomainEvent } from "@/lib/domain-events";
import { logInfo } from "@/lib/observability";

type IngestionRunner = {
  marketId: string;
  label: string;
  run: () => Promise<{
    runId: string;
    marketId: string;
    recordsFound: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsScanned?: number;
  }>;
};

const ingestionRunners: IngestionRunner[] = [
  {
    marketId: "ca-eldorado-west-slope",
    label: "El Dorado",
    run: ingestElDoradoPermitSignals,
  },
  {
    marketId: "ca-san-diego-development",
    label: "San Diego",
    run: ingestSanDiegoDevelopmentApprovals,
  },
];

async function runMarketIngestion(marketId: string) {
  const runner = ingestionRunners.find((candidate) => candidate.marketId === marketId);

  if (!runner) {
    throw new Error(`No ingestion runner configured for market "${marketId}".`);
  }

  const result = await runner.run();

  logInfo(`${runner.label} ingestion completed`, {
    runId: result.runId,
    marketId: result.marketId,
    recordsScanned: result.recordsScanned,
    recordsFound: result.recordsFound,
    recordsInserted: result.recordsInserted,
    recordsUpdated: result.recordsUpdated,
  });
  await emitDomainEvent({
    eventType: "ingestion.market.completed",
    aggregateType: "ingestion_run",
    aggregateId: result.runId,
    payload: {
      marketId: result.marketId,
      recordsScanned: result.recordsScanned,
      recordsFound: result.recordsFound,
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
    },
  });

  return result;
}

export async function runElDoradoIngestion() {
  return runMarketIngestion("ca-eldorado-west-slope");
}

export async function runSanDiegoIngestion() {
  return runMarketIngestion("ca-san-diego-development");
}

export async function runAllIngestions() {
  const markets = await Promise.all(ingestionRunners.map((runner) => runMarketIngestion(runner.marketId)));

  return {
    markets,
    recordsFound: markets.reduce((sum, market) => sum + market.recordsFound, 0),
    recordsInserted: markets.reduce((sum, market) => sum + market.recordsInserted, 0),
    recordsUpdated: markets.reduce((sum, market) => sum + market.recordsUpdated, 0),
  };
}
