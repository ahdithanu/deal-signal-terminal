"use client";

import Link from "next/link";

import {
  formatConfidenceLevel,
  formatDate,
  formatDevelopmentStage,
  formatLocalContext,
  formatOpportunityType,
  formatPriorityBand,
  formatProjectScale,
  formatSignalType,
} from "@/lib/formatters";
import type { Opportunity, WatchlistSnapshot } from "@/types/domain";
import { WatchlistToggle } from "@/components/watchlist-toggle";

export function SignalCard({
  opportunity,
  compact = false,
  watchlistStatus,
}: {
  opportunity: Opportunity;
  compact?: boolean;
  watchlistStatus?: {
    savedAt: string | null;
    hasUpdateSinceSave: boolean;
    changeSummary?: string | null;
    intelNotes?: string[];
  };
}) {
  const primaryTitle = opportunity.projectName ?? opportunity.title;
  const sourceEvidence = opportunity.evidence[0];
  const snapshot: WatchlistSnapshot = {
    priorityScore: opportunity.priorityScore,
    confidenceLevel: opportunity.confidenceLevel,
    developmentStage: opportunity.developmentStage,
    latestTimelineDate: opportunity.timeline[opportunity.timeline.length - 1]?.date ?? null,
  };

  return (
    <article className={`signal-card${compact ? " signal-card-compact" : ""}`}>
      <div className="signal-main">
        <div className="signal-top">
          <div className="signal-header-copy">
            <p className="eyebrow">Ranked opportunity</p>
            <div className="chip-row signal-chip-row-primary">
              <span className="chip chip-accent">{formatSignalType(opportunity.signalType)}</span>
              <span className="chip">{formatProjectScale(opportunity.projectScale)} scale</span>
              <span className="chip">
                {formatConfidenceLevel(opportunity.confidenceLevel)} confidence
              </span>
              {watchlistStatus?.hasUpdateSinceSave ? (
                <span className="chip chip-alert">Updated since save</span>
              ) : null}
            </div>
            <h2 className="signal-title">
              <Link className="signal-link" href={`/opportunity/${opportunity.slug}`}>
                {primaryTitle}
              </Link>
            </h2>
            {primaryTitle !== opportunity.title ? (
              <p className="signal-subtitle">{opportunity.title}</p>
            ) : null}
            <p className="signal-location">{opportunity.locationLabel}</p>
          </div>
          <WatchlistToggle
            opportunityId={opportunity.id}
            snapshot={snapshot}
            savedLabel="Saved"
            unsavedLabel="Save"
          />
        </div>

        {!compact ? (
          <>
            <div className="signal-thesis-block">
              <span className="copy-label">Why this matters</span>
              <p className="signal-thesis">{opportunity.whyItMatters}</p>
            </div>

            <div className="signal-action-block">
              <span className="copy-label">Do next</span>
              <p>{opportunity.nextStep}</p>
            </div>
          </>
        ) : (
          <div className="signal-thesis-block">
            <span className="copy-label">Why this matters</span>
            <p className="compact-copy">{opportunity.whyItMatters}</p>
          </div>
        )}

        <div className="signal-context-strip">
          <span>{formatOpportunityType(opportunity.opportunityType)}</span>
          <span>{formatDevelopmentStage(opportunity.developmentStage)}</span>
          <span>{formatLocalContext(opportunity.localContext)}</span>
        </div>

        <div className="signal-meta">
          <span>
            Source:{" "}
            <a href={sourceEvidence.pageUrl} rel="noreferrer" target="_blank">
              {sourceEvidence.reportLabel}
            </a>
          </span>
          <span>Date: {formatDate(opportunity.metadata.latestSignalDate)}</span>
          {watchlistStatus?.savedAt ? <span>Saved: {formatDate(watchlistStatus.savedAt)}</span> : null}
        </div>

        {watchlistStatus?.changeSummary ? (
          <div className="signal-update-note">
            <strong>{watchlistStatus.changeSummary}</strong>
            {watchlistStatus.intelNotes?.length ? (
              <ul className="signal-update-list">
                {watchlistStatus.intelNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="score-panel">
        <div>
          <div className="score-label">Priority score</div>
          <div className="score-number">{opportunity.priorityScore}</div>
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.min(100, opportunity.priorityScore)}%` }}
            />
          </div>
        </div>

        <div className="score-summary">
          <div>{formatPriorityBand(opportunity.priorityBand)} queue position</div>
          <div>{opportunity.tags.slice(0, 2).join(" · ")}</div>
        </div>

        <div className="button-stack">
          <Link className="button" href={`/opportunity/${opportunity.slug}`}>
            Open detail
          </Link>
          <Link className="button button-secondary" href={`/memo/${opportunity.slug}`}>
            Open memo
          </Link>
        </div>
      </aside>
    </article>
  );
}
