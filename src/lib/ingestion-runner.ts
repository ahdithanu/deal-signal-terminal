import { ingestElDoradoPermitSignals } from "@/lib/ingest-eldorado";
import { ingestSanDiegoDevelopmentApprovals } from "@/lib/ingest-sandiego";
import { logInfo } from "@/lib/observability";

export async function runElDoradoIngestion() {
  const result = await ingestElDoradoPermitSignals();

  logInfo("El Dorado ingestion completed", {
    runId: result.runId,
    marketId: result.marketId,
    recordsFound: result.recordsFound,
    recordsInserted: result.recordsInserted,
    recordsUpdated: result.recordsUpdated,
  });

  return result;
}

export async function runSanDiegoIngestion() {
  const result = await ingestSanDiegoDevelopmentApprovals();

  logInfo("San Diego ingestion completed", {
    runId: result.runId,
    marketId: result.marketId,
    recordsScanned: result.recordsScanned,
    recordsFound: result.recordsFound,
    recordsInserted: result.recordsInserted,
    recordsUpdated: result.recordsUpdated,
  });

  return result;
}

export async function runAllIngestions() {
  const elDorado = await runElDoradoIngestion();
  const sanDiego = await runSanDiegoIngestion();

  return {
    markets: [elDorado, sanDiego],
    recordsFound: elDorado.recordsFound + sanDiego.recordsFound,
    recordsInserted: elDorado.recordsInserted + sanDiego.recordsInserted,
    recordsUpdated: elDorado.recordsUpdated + sanDiego.recordsUpdated,
  };
}
