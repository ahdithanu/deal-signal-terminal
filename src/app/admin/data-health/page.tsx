import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listDataHealthByMarket } from "@/lib/ingestion-store";

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

  const markets = await listDataHealthByMarket();
  const totalRecords = markets.reduce((sum, market) => sum + market.permit_records, 0);
  const latestAccessedAt = markets
    .map((market) => market.latest_accessed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Admin</p>
        <h1 className="detail-title">Data health</h1>
        <p className="tight-copy">
          Track source coverage, raw permit volume, and ingestion run status before generated
          opportunities depend on a broader live data pipeline.
        </p>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Markets</p>
          <strong className="metric-value">{markets.length}</strong>
          <p className="subtle-text">with source or ingestion activity</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Raw records</p>
          <strong className="metric-value">{totalRecords}</strong>
          <p className="subtle-text">normalized permit records stored</p>
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
            <h2 className="section-title">Launch-market data backbone</h2>
          </div>
          <div className="subtle-text">{markets.length} markets</div>
        </div>

        {markets.length === 0 ? (
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
                <th>Latest access</th>
                <th>Latest run</th>
                <th>Run output</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr key={market.market_id}>
                  <td>
                    <strong>{market.market_id}</strong>
                  </td>
                  <td>{market.source_documents}</td>
                  <td>{market.permit_records}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
