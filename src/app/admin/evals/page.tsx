import { redirect } from "next/navigation";

import { EvalRunButton } from "@/components/eval-run-button";
import { getAuthSession } from "@/lib/auth";
import { listEvalDatasets, listEvalRuns } from "@/lib/ai-evals";

export default async function AdminEvalsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/");
  }

  const [datasets, runs] = await Promise.all([listEvalDatasets(), listEvalRuns()]);
  const primaryDataset = datasets[0];

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">AI infrastructure</p>
            <h1 className="detail-title">Evaluation platform</h1>
            <p className="tight-copy">
              Run regression suites against Copilot and research behavior before changing prompts,
              models, retrieval, or scoring policy.
            </p>
          </div>
          {primaryDataset ? <EvalRunButton datasetId={primaryDataset.id} /> : null}
        </div>
      </section>

      <section className="metric-grid">
        <div className="panel">
          <p className="eyebrow">Suites</p>
          <strong className="metric-value">{datasets.length}</strong>
          <p className="subtle-text">registered eval datasets</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Latest status</p>
          <strong className="metric-value metric-value-text">{runs[0]?.status ?? "not run"}</strong>
          <p className="subtle-text">most recent suite outcome</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Latest score</p>
          <strong className="metric-value">{Math.round((runs[0]?.averageScore ?? 0) * 100)}%</strong>
          <p className="subtle-text">average assertion pass rate</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Regression gate</p>
          <strong className="metric-value metric-value-text">
            {runs[0] ? (runs[0].gatePassed ? "passed" : "failed") : "not run"}
          </strong>
          <p className="subtle-text">critical workflow threshold</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Datasets</p>
            <h2 className="section-title">Registered eval datasets</h2>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target</th>
              <th>Cases</th>
              <th>Purpose</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((dataset) => (
              <tr key={dataset.id}>
                <td>
                  <strong>{dataset.name}</strong>
                  <div className="table-subtext">{dataset.id}</div>
                </td>
                <td>{dataset.workflow}</td>
                <td>{dataset.cases.length}</td>
                <td>
                  {dataset.description}
                  <div className="table-subtext">
                    Gate threshold {Math.round(dataset.criticalThreshold * 100)}%
                  </div>
                </td>
                <td>
                  <EvalRunButton datasetId={dataset.id} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Run history</p>
            <h2 className="section-title">Recent eval runs</h2>
          </div>
        </div>
        {runs.length === 0 ? (
          <p className="tight-copy">No eval runs yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Score</th>
                <th>Gate</th>
                <th>Cases</th>
                <th>Prompt</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                  <td>{run.status}</td>
                  <td>{Math.round(run.averageScore * 100)}%</td>
                  <td>{run.gatePassed ? "passed" : "failed"}</td>
                  <td>
                    {run.passedCases}/{run.totalCases}
                  </td>
                  <td>{run.promptVersion}</td>
                  <td>
                    {run.totalPromptTokens + run.totalCompletionTokens}
                    <div className="table-subtext">${run.totalCostUsd.toFixed(4)}</div>
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
