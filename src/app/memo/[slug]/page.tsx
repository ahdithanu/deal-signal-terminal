import { notFound, redirect } from "next/navigation";

import { MemoCopyButton } from "@/components/memo-copy-button";
import { MemoPrintButton } from "@/components/memo-print-button";
import { generateOpportunityMemo } from "@/lib/ai";
import { getAuthSession } from "@/lib/auth";
import { formatConfidenceLevel, formatDate, formatOpportunityType } from "@/lib/formatters";
import { getOpportunityBySlug } from "@/lib/opportunities";

export const dynamic = "force-dynamic";

export default async function MemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }
  const { slug } = await params;
  const opportunity = getOpportunityBySlug(slug);

  if (!opportunity) {
    notFound();
  }

  const memo = await generateOpportunityMemo(opportunity);

  return (
    <div className="page-stack">
      <section className="panel memo-header">
        <div className="section-header">
          <div className="memo-header-copy">
            <p className="eyebrow">AI memo generator</p>
            <h1 className="detail-title">{opportunity.title}</h1>
            <p className="tight-copy">
              {formatOpportunityType(opportunity.opportunityType)} lead in {opportunity.locationLabel}
            </p>
            <p className="memo-header-summary">{memo.summary}</p>
          </div>
          <div className="button-stack">
            <MemoCopyButton memo={memo.body} />
            <MemoPrintButton />
          </div>
        </div>

        <div className="detail-hero-grid memo-header-grid">
          <div className="detail-hero-card detail-hero-card-primary">
            <span className="copy-label">Memo posture</span>
            <p>
              {memo.mode === "openai"
                ? "Generated with OpenAI against the current structured record, with missing facts left explicit."
                : "Generated from the fact-safe rules fallback, using only structured source evidence and missing-fact discipline."}
            </p>
          </div>
          <div className="detail-hero-card">
            <span className="copy-label">Current read</span>
            <ul className="detail-hero-list">
              <li>{formatConfidenceLevel(opportunity.confidenceLevel)} confidence</li>
              <li>{formatOpportunityType(opportunity.opportunityType)}</li>
              <li>Generated {formatDate(memo.generatedAt.slice(0, 10))}</li>
              <li>{memo.mode === "openai" ? "OpenAI output" : "Rules fallback"}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="stack">
          <div className="panel">
            <p className="eyebrow">Memo draft</p>
            <h2 className="section-title">Decision-ready investment brief</h2>
            <div className="memo-body">{memo.body}</div>
          </div>
        </div>

        <div className="stack">
          <div className="panel memo-side-panel">
            <p className="eyebrow">Ground rules</p>
            <h3 className="section-title">What the memo will not do</h3>
            <ul className="plain-list">
              <li>It does not invent valuation, ownership, tenant, or scope facts that are absent.</li>
              <li>It treats permit data as an opportunity signal, not full underwriting.</li>
              <li>It keeps the recommended next step tied to public evidence and obvious diligence.</li>
            </ul>
          </div>

          <div className="panel memo-side-panel">
            <p className="eyebrow">Source evidence</p>
            <h3 className="section-title">Memo inputs</h3>
            <div className="evidence-stack">
              {opportunity.evidence.map((evidence) => (
                <div className="evidence-card" key={evidence.id}>
                  <strong>{evidence.recordId}</strong>
                  <p>{evidence.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
