import { ingestElDoradoPermitSignals } from "@/lib/ingest-eldorado";
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
