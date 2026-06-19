import { redirect } from "next/navigation";

import { IngestionRunButton } from "@/components/ingestion-run-button";
import { coverageSourceLabels, getCoverageSummary, marketCoverage } from "@/data/coverage";
import { getAuthSession } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listDataHealthByMarket } from "@/lib/ingestion-store";
import { listGeneratedOpportunityHealth } from "@/lib/opportunity-service";

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value.slice(0, 10)) : "N/A";
}

export default async function DataHealthAdminPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const [observedMarkets, generatedOpportunityHealth] = await Promise.all([
    listDataHealthByMarket(),
    listGeneratedOpportunityHealth(),
  ]);
  const coverageSummary = getCoverageSummary();
  const totalRecords = observedMarkets.reduce((sum, market) => sum + market.permit_records, 0);
  const totalGeneratedOpportunities = generatedOpportunityHealth.reduce(
    (sum, market) => sum + market.generatedOpportunities,
    0
  );
  const totalSurfacedGeneratedOpportunities = generatedOpportunityHealth.reduce(
    (sum, market) => sum + market.surfacedOpportunities,
    0
  );
  const generatedHealthByMarket = new Map(
    generatedOpportunityHealth.map((market) => [market.marketId, market])
  );
  const latestAccessedAt = observedMarkets
    .map((market) => market.latest_accessed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="detail-title">Data health</h1>
            <p className="tight-copy">
              Track configured coverage, observed raw permit volume, and ingestion status before
              generated opportunities depend on a broader nationwide data pipeline.
            </p>
          </div>
          <div className="admin-action-stack">
            <IngestionRunButton />
            <IngestionRunButton
              endpoint="/api/admin/ingest/sandiego"
              label="Run San Diego ingest"
              runningLabel="Running San Diego ingest"
            />
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Markets</p>
          <strong className="metric-value">{coverageSummary.live}</strong>
          <p className="subtle-text">live configured markets</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Raw records</p>
          <strong className="metric-value">{totalRecords}</strong>
          <p className="subtle-text">normalized permit records stored</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Generated opps</p>
          <strong className="metric-value">{totalGeneratedOpportunities}</strong>
          <p className="subtle-text">
            {totalSurfacedGeneratedOpportunities} surfaced in ranked workflows
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">Latest access</p>
          <strong className="metric-value metric-value-text">
            {formatOptionalDate(latestAccessedAt ?? null)}
          </strong>
          <p className="subtle-text">most recent source document access</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Coverage</p>
            <h2 className="section-title">Nationwide expansion registry</h2>
            <p className="tight-copy">
              Live markets power the current product. Queued and evaluating markets are expansion
              targets that still need source validation before they can generate opportunities.
            </p>
          </div>
          <div className="subtle-text">
            {coverageSummary.total} configured · {coverageSummary.queued} queued ·{" "}
            {coverageSummary.evaluating} evaluating
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Status</th>
              <th>Source families</th>
              <th>Why next</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {marketCoverage.map((market) => (
              <tr key={market.id}>
                <td>
                  <strong>{market.name}</strong>
                  <div className="table-subtext">{market.region}</div>
                </td>
                <td>
                  <span className={market.status === "live" ? "chip chip-accent" : "chip"}>
                    {market.status}
                  </span>
                </td>
                <td>
                  {market.sourceFamilies
                    .map((sourceFamily) => coverageSourceLabels[sourceFamily])
                    .join(", ")}
                </td>
                <td>{market.reason}</td>
                <td>{market.nextStep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Observed data</p>
            <h2 className="section-title">Stored source and ingestion health</h2>
            <p className="tight-copy">
              This table only reflects markets with stored source documents, raw records, or
              ingestion runs. It is not the same thing as total configured expansion coverage.
            </p>
          </div>
          <div className="subtle-text">{observedMarkets.length} markets with stored activity</div>
        </div>

        {observedMarkets.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <p className="tight-copy">
              No source documents, raw permit records, or ingestion runs have been stored yet.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Sources</th>
                <th>Permit records</th>
                <th>Generated opps</th>
                <th>Latest access</th>
                <th>Latest run</th>
                <th>Run output</th>
              </tr>
            </thead>
            <tbody>
              {observedMarkets.map((market) => {
                const generatedHealth = generatedHealthByMarket.get(market.market_id);

                return (
                  <tr key={market.market_id}>
                    <td>
                      <strong>{market.market_id}</strong>
                    </td>
                    <td>{market.source_documents}</td>
                    <td>{market.permit_records}</td>
                    <td>
                      <strong>{generatedHealth?.generatedOpportunities ?? 0}</strong>
                      <div className="table-subtext">
                        {generatedHealth?.surfacedOpportunities ?? 0} surfaced ·{" "}
                        {generatedHealth?.generatedSignals ?? 0} signals
                      </div>
                      {generatedHealth?.topOpportunity ? (
                        <div className="table-subtext">
                          Top: {generatedHealth.topOpportunity.title} (
                          {generatedHealth.topOpportunity.priorityScore})
                        </div>
                      ) : null}
                    </td>
                    <td>{formatOptionalDate(market.latest_accessed_at)}</td>
                    <td>
                      <strong>{market.latest_run_status ?? "N/A"}</strong>
                      <div className="table-subtext">
                        {formatOptionalDate(market.latest_run_started_at)}
                      </div>
                    </td>
                    <td>
                      <strong>{market.latest_run_records_found ?? 0}</strong>
                      <div className="table-subtext">
                        {market.latest_run_records_inserted ?? 0} inserted ·{" "}
                        {market.latest_run_records_updated ?? 0} updated
                      </div>
                      {market.latest_run_error_message ? (
                        <div className="table-subtext">{market.latest_run_error_message}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Opportunity generation</p>
            <h2 className="section-title">Stored records converting into ranked workflow output</h2>
            <p className="tight-copy">
              This is the operational proof point for expansion: source ingestion should create
              generated opportunities that can be opened, ranked, memoed, and monitored.
            </p>
          </div>
          <div className="subtle-text">
            {totalGeneratedOpportunities} generated · {totalSurfacedGeneratedOpportunities} surfaced
          </div>
        </div>

        {generatedOpportunityHealth.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <p className="tight-copy">
              No generated opportunities yet. Run ingestion for a live market, then refresh this
              page to confirm stored records are converting into ranked workflow output.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Signals</th>
                <th>Generated opportunities</th>
                <th>Surfaced</th>
                <th>Top generated lead</th>
              </tr>
            </thead>
            <tbody>
              {generatedOpportunityHealth.map((market) => (
                <tr key={market.marketId}>
                  <td>
                    <strong>{market.marketId}</strong>
                  </td>
                  <td>{market.generatedSignals}</td>
                  <td>{market.generatedOpportunities}</td>
                  <td>{market.surfacedOpportunities}</td>
                  <td>
                    {market.topOpportunity ? (
                      <>
                        <strong>{market.topOpportunity.title}</strong>
                        <div className="table-subtext">
                          {market.topOpportunity.priorityScore} · {market.topOpportunity.priorityBand}
                        </div>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
