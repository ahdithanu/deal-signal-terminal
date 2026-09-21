import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { listPilotLeads } from "@/lib/pilot-leads";

export default async function PilotLeadsAdminPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const leads = listPilotLeads();

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Admin</p>
        <h1 className="detail-title">Pilot pipeline</h1>
        <p className="tight-copy">
          Review inbound pilot requests, who submitted them, and what workflow or market they want
          to test next.
        </p>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Inbound requests</p>
            <h2 className="section-title">Pilot interest</h2>
          </div>
          <div className="subtle-text">{leads.length} requests</div>
        </div>

        {leads.length === 0 ? (
          <div className="empty-state empty-state-inline">
            <p className="tight-copy">No pilot requests have been submitted yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Contact</th>
                <th>Company</th>
                <th>Role</th>
                <th>Market</th>
                <th>Team</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatDate(lead.created_at.slice(0, 10))}</td>
                  <td>
                    <strong>{lead.name}</strong>
                    <div className="table-subtext">{lead.email}</div>
                  </td>
                  <td>{lead.company}</td>
                  <td>{lead.role ?? "N/A"}</td>
                  <td>{lead.market_focus ?? "N/A"}</td>
                  <td>{lead.team_size ?? "N/A"}</td>
                  <td>
                    <code className="table-code">{lead.notes}</code>
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
