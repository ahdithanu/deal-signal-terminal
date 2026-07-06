import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { getEventDashboard } from "@/lib/domain-events";

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

export default async function AdminEventsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const dashboard = await getEventDashboard();

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Infrastructure</p>
            <h1 className="detail-title">Event outbox</h1>
            <p className="tight-copy">
              Track durable domain events emitted by ingestion, Copilot, evals, and human review.
              Pending events can later fan out to queues, webhooks, audit projections, or customer
              integrations.
            </p>
          </div>
          <div className="subtle-text">{dashboard.recentEvents.length} recent events</div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Pending</p>
          <strong className="metric-value">{dashboard.pending}</strong>
          <p className="subtle-text">waiting for dispatch</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Published</p>
          <strong className="metric-value">{dashboard.published}</strong>
          <p className="subtle-text">successfully dispatched</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Failed</p>
          <strong className="metric-value">{dashboard.failed}</strong>
          <p className="subtle-text">needs retry or inspection</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Subscriptions</p>
          <strong className="metric-value">{dashboard.subscriptions.length}</strong>
          <p className="subtle-text">configured consumers</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Outbox</p>
            <h2 className="section-title">Recent domain events</h2>
          </div>
        </div>
        {dashboard.recentEvents.length === 0 ? (
          <p className="tight-copy">No domain events have been emitted yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Status</th>
                <th>Aggregate</th>
                <th>Attempts</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatTime(event.createdAt)}</td>
                  <td>{event.eventType}</td>
                  <td>{event.status}</td>
                  <td>
                    <strong>{event.aggregateType}</strong>
                    <div className="table-subtext">{event.aggregateId}</div>
                  </td>
                  <td>{event.attempts}</td>
                  <td>
                    <span className="table-code">{JSON.stringify(event.payload)}</span>
                    {event.errorMessage ? (
                      <div className="table-subtext">{event.errorMessage}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Consumers</p>
            <h2 className="section-title">Event subscriptions</h2>
          </div>
        </div>
        {dashboard.subscriptions.length === 0 ? (
          <p className="tight-copy">
            No subscriptions yet. The outbox is ready for internal projections, queues, and
            webhooks when customer integrations are enabled.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.name}</td>
                  <td>{subscription.eventType}</td>
                  <td>
                    {subscription.targetType}
                    <div className="table-subtext">{subscription.targetRef}</div>
                  </td>
                  <td>{subscription.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
