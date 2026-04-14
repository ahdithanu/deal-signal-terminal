import Link from "next/link";
import { notFound } from "next/navigation";

import { NotesPanel } from "@/components/notes-panel";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { buildOpportunitySummary } from "@/lib/ai";
import {
  formatConfidenceLevel,
  formatCurrency,
  formatDate,
  formatDevelopmentStage,
  formatLocalContext,
  formatLotSizeAcres,
  formatOpportunityType,
  formatOwnershipEntityType,
  formatParcelContextStatus,
  formatPermitTimelineStage,
  formatPropertyKind,
  formatProjectScale,
  formatSignalType,
} from "@/lib/formatters";
import { getOpportunityBySlug } from "@/lib/opportunities";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opportunity = getOpportunityBySlug(slug);

  if (!opportunity) {
    notFound();
  }

  const summary = buildOpportunitySummary(opportunity);
  const primaryTitle = opportunity.projectName ?? opportunity.title;
  const confidenceRead =
    opportunity.confidenceLevel === "high"
      ? "The public record is clear enough to treat this as an active diligence lead now."
      : opportunity.confidenceLevel === "medium"
        ? "The development implication is plausible, but follow-on permits or ownership context still matter before leaning in."
        : "The record is thin enough that this should stay a monitoring item rather than an active pursuit.";
  const localContextRead =
    opportunity.localContext === "isolated"
      ? "It currently reads as a one-off signal rather than a broader area pattern."
      : "Nearby related signals add context, but the local pattern only matters because the underlying record stands on its own.";

  return (
    <div className="page-stack">
      <section className="detail-hero panel">
        <div className="detail-topline">
          <div className="detail-hero-copy">
            <p className="eyebrow">Opportunity detail</p>
            <h1 className="detail-title">{primaryTitle}</h1>
            {primaryTitle !== opportunity.title ? (
              <p className="signal-subtitle">{opportunity.title}</p>
            ) : null}
            <p className="signal-location">{opportunity.locationLabel}</p>
            <p className="detail-hero-summary">{summary}</p>
          </div>

          <div className="detail-actions">
            <div className="score-badge-large">
              <span>Priority</span>
              <strong>{opportunity.priorityScore}</strong>
            </div>
            <WatchlistToggle
              opportunityId={opportunity.id}
              snapshot={{
                priorityScore: opportunity.priorityScore,
                confidenceLevel: opportunity.confidenceLevel,
                developmentStage: opportunity.developmentStage,
                latestTimelineDate:
                  opportunity.timeline[opportunity.timeline.length - 1]?.date ?? null,
              }}
              savedLabel="Saved"
              unsavedLabel="Add to watchlist"
            />
            <Link className="button" href={`/memo/${opportunity.slug}`}>
              Open memo draft
            </Link>
          </div>
        </div>

        <div className="detail-hero-grid">
          <div className="detail-hero-card detail-hero-card-primary">
            <span className="copy-label">Working thesis</span>
            <p>{opportunity.thesis}</p>
          </div>
          <div className="detail-hero-card">
            <span className="copy-label">Current read</span>
            <ul className="detail-hero-list">
              <li>{formatOpportunityType(opportunity.opportunityType)}</li>
              <li>{formatDevelopmentStage(opportunity.developmentStage)}</li>
              <li>{formatProjectScale(opportunity.projectScale)}</li>
              <li>{formatConfidenceLevel(opportunity.confidenceLevel)} confidence</li>
              <li>{formatSignalType(opportunity.signalType)}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="stack">
          <div className="panel">
            <p className="eyebrow">Developer brief</p>
            <h2 className="section-title">Current read</h2>
            <div className="decision-grid decision-grid-brief">
              <div className="decision-card decision-card-primary">
                <span className="copy-label">Why this matters</span>
                <p>{opportunity.whyItMatters}</p>
              </div>
              <div className="decision-card decision-card-strong">
                <span className="copy-label">Do next</span>
                <p>{opportunity.nextStep}</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Decision frame</p>
                <h2 className="section-title">Why it matters and what to do next</h2>
              </div>
            </div>

            <div className="decision-grid">
              <div className="decision-card">
                <span className="copy-label">Confidence read</span>
                <p>{confidenceRead}</p>
              </div>
              <div className="decision-card">
                <span className="copy-label">Local context</span>
                <p>{localContextRead}</p>
              </div>
            </div>

            <div className="decision-card decision-card-muted">
              <span className="copy-label">Missing facts to close</span>
              {opportunity.missingFacts.length ? (
                <ul className="plain-list plain-list-tight">
                  {opportunity.missingFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="tight-copy">
                  The available public record is reasonably complete for a first-pass diligence view.
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Permit timeline</p>
                <h2 className="section-title">How the signal progressed</h2>
              </div>
              <div className="subtle-text">{opportunity.timeline.length} timeline events</div>
            </div>

            <div className="timeline-list">
              {opportunity.timeline.map((entry) => (
                <div className="timeline-row" key={entry.id}>
                  <div className="timeline-date">
                    <strong>{formatDate(entry.date)}</strong>
                    <span>{formatPermitTimelineStage(entry.stage)}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-topline">
                      <strong>{entry.permitNumber}</strong>
                      <span className="timeline-type">
                        {entry.permitType} / {entry.permitSubtype}
                      </span>
                    </div>
                    <p>{entry.description}</p>
                    <div className="subtle-text">Current permit status: {entry.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Source evidence</p>
                <h2 className="section-title">What supports the readout</h2>
              </div>
              <div className="subtle-text">{opportunity.evidence.length} sourced excerpts</div>
            </div>

            <div className="evidence-stack">
              {opportunity.evidence.map((evidence) => (
                <div className="evidence-card" key={evidence.id}>
                  <strong>{evidence.recordId}</strong>
                  <p>{evidence.excerpt}</p>
                  <div className="signal-meta">
                    <span>{evidence.reportLabel}</span>
                    <a href={evidence.url} rel="noreferrer" target="_blank">
                      Open source file
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Ownership and parcel</p>
                <h2 className="section-title">APN-level context</h2>
              </div>
              <div className="subtle-text">
                {formatParcelContextStatus(opportunity.parcelContext.status)}
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-card">
                <span>Context source</span>
                <strong>{opportunity.parcelContext.sourceLabel}</strong>
              </div>
              <div className="metadata-card">
                <span>Owner</span>
                <strong>{opportunity.parcelContext.ownerName ?? "Pending"}</strong>
              </div>
              <div className="metadata-card">
                <span>Owner type</span>
                <strong>
                  {formatOwnershipEntityType(opportunity.parcelContext.ownershipEntityType)}
                </strong>
              </div>
              <div className="metadata-card">
                <span>Mailing city</span>
                <strong>{opportunity.parcelContext.ownerMailingCity ?? "Pending"}</strong>
              </div>
              <div className="metadata-card">
                <span>Zoning</span>
                <strong>{opportunity.parcelContext.zoning ?? "Pending"}</strong>
              </div>
              <div className="metadata-card">
                <span>Land use</span>
                <strong>{opportunity.parcelContext.landUse ?? "Pending"}</strong>
              </div>
              <div className="metadata-card">
                <span>Lot size</span>
                <strong>{formatLotSizeAcres(opportunity.parcelContext.lotSizeAcres)}</strong>
              </div>
              <div className="metadata-card">
                <span>Last transfer</span>
                <strong>{formatDate(opportunity.parcelContext.lastTransferDate)}</strong>
              </div>
              <div className="metadata-card">
                <span>Assessed value</span>
                <strong>{formatCurrency(opportunity.parcelContext.assessedValue)}</strong>
              </div>
            </div>

            <div className="decision-card decision-card-muted">
              <span className="copy-label">Context and diligence read</span>
              <p className="tight-copy">
                {opportunity.parcelContext.transferContext ??
                  "Transfer context is still missing, so ownership timing and basis remain open diligence questions."}
              </p>
              <p className="tight-copy context-source-note">
                {opportunity.parcelContext.sourceLabel} as of{" "}
                {formatDate(opportunity.parcelContext.sourceAsOf)}.
              </p>
              <ul className="plain-list plain-list-tight">
                {opportunity.parcelContext.contextNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <NotesPanel opportunityId={opportunity.id} />

          <div className="panel">
            <p className="eyebrow">Full signal record</p>
            <h2 className="section-title">Normalized raw filings</h2>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Permit</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {opportunity.signals.map((signal) => (
                  <tr key={signal.id}>
                    <td>{signal.permitNumber}</td>
                    <td>
                      <strong>{signal.permitType}</strong>
                      <div className="table-subtext">{signal.permitSubtype}</div>
                    </td>
                    <td>{signal.status}</td>
                    <td>{formatDate(signal.issuedDate ?? signal.approvedDate ?? signal.appliedDate)}</td>
                    <td>{signal.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <p className="eyebrow">Assessment snapshot</p>
            <h3 className="section-title">How to read this signal</h3>
            <div className="mini-grid">
              <div className="mini-metric">
                <strong>{formatConfidenceLevel(opportunity.confidenceLevel)}</strong>
                <span>Confidence</span>
              </div>
              <div className="mini-metric">
                <strong>{formatDevelopmentStage(opportunity.developmentStage)}</strong>
                <span>Development stage</span>
              </div>
              <div className="mini-metric">
                <strong>{formatLocalContext(opportunity.localContext)}</strong>
                <span>Local context</span>
              </div>
              <div className="mini-metric">
                <strong>{formatDate(opportunity.metadata.latestSignalDate)}</strong>
                <span>Latest signal</span>
              </div>
            </div>
            <p className="tight-copy assessment-note">
              {confidenceRead} {localContextRead}
            </p>
          </div>

          <ScoreBreakdown opportunity={opportunity} />

          <div className="panel">
            <p className="eyebrow">Structured metadata</p>
            <h3 className="section-title">Opportunity metadata</h3>
            <div className="metadata-grid">
              <div className="metadata-card">
                <span>First signal</span>
                <strong>{formatDate(opportunity.metadata.firstSignalDate)}</strong>
              </div>
              <div className="metadata-card">
                <span>Jurisdiction</span>
                <strong>{opportunity.metadata.jurisdiction}</strong>
              </div>
              <div className="metadata-card">
                <span>APN</span>
                <strong>{opportunity.metadata.siteApn}</strong>
              </div>
              <div className="metadata-card">
                <span>Corridor tier</span>
                <strong>{opportunity.metadata.corridorTier}</strong>
              </div>
              <div className="metadata-card">
                <span>Capital profile</span>
                <strong>{opportunity.metadata.capitalProfile}</strong>
              </div>
              <div className="metadata-card">
                <span>Project scale</span>
                <strong>{formatProjectScale(opportunity.projectScale)}</strong>
              </div>
              <div className="metadata-card">
                <span>Property kind</span>
                <strong>{formatPropertyKind(opportunity.metadata.propertyKind)}</strong>
              </div>
              <div className="metadata-card">
                <span>Reporting window</span>
                <strong>{opportunity.metadata.reportingWindow}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
