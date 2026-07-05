import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { listPromptRegistryEvents, listPromptTemplates } from "@/lib/prompt-registry";

export default async function AdminPromptsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const [templates, events] = await Promise.all([listPromptTemplates(), listPromptRegistryEvents()]);
  const activeVersions = templates.filter((template) => template.activeVersion).length;
  const draftVersions = templates.reduce(
    (sum, template) => sum + template.versions.filter((version) => version.status === "draft").length,
    0
  );

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">AI control plane</p>
            <h1 className="detail-title">Prompt registry</h1>
            <p className="tight-copy">
              Track prompt templates, active versions, model families, output schemas, and rollout
              history before changing customer-facing AI behavior.
            </p>
          </div>
          <div className="subtle-text">
            {templates.length} templates · {activeVersions} active · {draftVersions} draft
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Templates</p>
          <strong className="metric-value">{templates.length}</strong>
          <p className="subtle-text">registered AI workflows</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Active versions</p>
          <strong className="metric-value">{activeVersions}</strong>
          <p className="subtle-text">currently assigned prompt versions</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Draft versions</p>
          <strong className="metric-value">{draftVersions}</strong>
          <p className="subtle-text">not yet activated</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Recent events</p>
          <strong className="metric-value">{events.length}</strong>
          <p className="subtle-text">registry changes captured</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Templates</p>
            <h2 className="section-title">Prompt versions by workflow</h2>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Prompt</th>
              <th>Workflow</th>
              <th>Active version</th>
              <th>Model family</th>
              <th>Variables</th>
              <th>Versions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>
                  <strong>{template.name}</strong>
                  <div className="table-subtext">{template.promptKey}</div>
                  <div className="table-subtext">{template.description}</div>
                </td>
                <td>{template.workflow}</td>
                <td>
                  {template.activeVersion?.version ?? "none"}
                  <div className="table-subtext">
                    {template.activeVersion?.activatedAt
                      ? new Date(template.activeVersion.activatedAt).toLocaleString()
                      : "not activated"}
                  </div>
                </td>
                <td>{template.activeVersion?.modelFamily ?? "N/A"}</td>
                <td>{template.activeVersion?.variables.join(", ") ?? "N/A"}</td>
                <td>
                  {template.versions.length}
                  <div className="table-subtext">
                    {template.versions.map((version) => `${version.version} (${version.status})`).join(", ")}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">History</p>
            <h2 className="section-title">Prompt registry events</h2>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="tight-copy">No prompt registry events recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Template</th>
                <th>Version</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.occurredAt).toLocaleString()}</td>
                  <td>{event.action}</td>
                  <td>{event.templateId}</td>
                  <td>{event.versionId ?? "N/A"}</td>
                  <td>
                    <span className="table-code">{JSON.stringify(event.metadata)}</span>
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
