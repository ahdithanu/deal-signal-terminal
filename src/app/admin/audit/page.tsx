import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { listRecentAuditEvents } from "@/lib/audit";
import { formatDate } from "@/lib/formatters";

export default async function AuditAdminPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const events = listRecentAuditEvents(100).map((event) => ({
    id: event.id,
    occurredAt: event.occurred_at,
    orgId: event.org_id,
    userId: event.user_id,
    action: event.action,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    metadata: JSON.parse(event.metadata_json) as Record<string, unknown>,
  }));

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Admin</p>
        <h1 className="detail-title">Audit trail</h1>
        <p className="tight-copy">
          Review the most recent authenticated platform events across login, watchlist activity,
          and note changes. This is the first admin-facing visibility layer for the enterprise path.
        </p>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Recent events</p>
            <h2 className="section-title">Operational activity</h2>
          </div>
          <div className="subtle-text">{events.length} events</div>
        </div>

        {events.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <p className="tight-copy">No audit events have been recorded yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Resource</th>
                <th>User</th>
                <th>Org</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.occurredAt.slice(0, 10))}</td>
                  <td>{event.action}</td>
                  <td>
                    <strong>{event.resourceType}</strong>
                    <div className="table-subtext">{event.resourceId ?? "N/A"}</div>
                  </td>
                  <td>{event.userId ?? "N/A"}</td>
                  <td>{event.orgId ?? "N/A"}</td>
                  <td>
                    <code className="table-code">{JSON.stringify(event.metadata)}</code>
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
