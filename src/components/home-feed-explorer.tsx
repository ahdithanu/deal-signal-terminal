"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { SignalCard } from "@/components/signal-card";
import {
  formatConfidenceLevel,
  formatDevelopmentStage,
  formatOpportunityType,
  formatPriorityBand,
} from "@/lib/formatters";
import { getFeedCategory } from "@/lib/opportunities";
import type { ConfidenceLevel, DevelopmentStage, Opportunity, OpportunityType, PriorityBand } from "@/types/domain";

type HomeFeedExplorerProps = {
  opportunities: Opportunity[];
};

type ScoreFilter = "all" | PriorityBand;
type AnalysisPrompt = "institutional" | "newest" | "early-stage" | "changed";
type FeedFilterState = {
  search: string;
  city: string;
  opportunityType: "all" | OpportunityType;
  confidence: "all" | ConfidenceLevel;
  stage: "all" | DevelopmentStage;
  scoreBand: ScoreFilter;
};

const defaultFilters: FeedFilterState = {
  search: "",
  city: "all",
  opportunityType: "all",
  confidence: "all",
  stage: "all",
  scoreBand: "all",
};

export function HomeFeedExplorer({ opportunities }: HomeFeedExplorerProps) {
  const [filters, setFilters] = useState<FeedFilterState>(defaultFilters);
  const [analysisPrompt, setAnalysisPrompt] = useState<AnalysisPrompt>("institutional");
  const deferredSearch = useDeferredValue(filters.search.trim().toLowerCase());

  const filterOptions = useMemo(() => {
    const cities = [
      ...new Set(opportunities.map((opportunity) => opportunity.signals[0]?.siteCity).filter(Boolean)),
    ].sort();
    const opportunityTypes = [...new Set(opportunities.map((opportunity) => opportunity.opportunityType))];
    const confidenceLevels = [...new Set(opportunities.map((opportunity) => opportunity.confidenceLevel))];
    const stages = [...new Set(opportunities.map((opportunity) => opportunity.developmentStage))];
    const priorityBands = [...new Set(opportunities.map((opportunity) => opportunity.priorityBand))];

    return {
      cities,
      opportunityTypes,
      confidenceLevels,
      stages,
      priorityBands,
    };
  }, [opportunities]);

  const visibleOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const city = opportunity.signals[0]?.siteCity ?? "";
      const haystack = [
        opportunity.title,
        opportunity.projectName,
        opportunity.locationLabel,
        opportunity.whyItMatters,
        opportunity.nextStep,
        ...opportunity.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (deferredSearch && !haystack.includes(deferredSearch)) {
        return false;
      }

      if (filters.city !== "all" && city !== filters.city) {
        return false;
      }

      if (filters.opportunityType !== "all" && opportunity.opportunityType !== filters.opportunityType) {
        return false;
      }

      if (filters.confidence !== "all" && opportunity.confidenceLevel !== filters.confidence) {
        return false;
      }

      if (filters.stage !== "all" && opportunity.developmentStage !== filters.stage) {
        return false;
      }

      if (filters.scoreBand !== "all" && opportunity.priorityBand !== filters.scoreBand) {
        return false;
      }

      return true;
    });
  }, [deferredSearch, filters, opportunities]);

  const mix = useMemo(() => {
    return visibleOpportunities.reduce(
      (summary, opportunity) => {
        const category = getFeedCategory(opportunity);
        if (category === "development") summary.development += 1;
        if (category === "repositioning") summary.repositioning += 1;
        if (category === "distress") summary.distress += 1;
        if (category === "residential_infill") summary.residentialInfill += 1;
        return summary;
      },
      { development: 0, repositioning: 0, distress: 0, residentialInfill: 0 }
    );
  }, [visibleOpportunities]);

  const hasActiveFilters =
    filters.search !== defaultFilters.search ||
    filters.city !== defaultFilters.city ||
    filters.opportunityType !== defaultFilters.opportunityType ||
    filters.confidence !== defaultFilters.confidence ||
    filters.stage !== defaultFilters.stage ||
    filters.scoreBand !== defaultFilters.scoreBand;

  const analysisSummary = useMemo(() => {
    if (!visibleOpportunities.length) {
      return "Widen the filters to bring opportunities back into view before running an analysis prompt.";
    }

    if (analysisPrompt === "institutional") {
      const ranked = [...visibleOpportunities]
        .filter((opportunity) => opportunity.projectScale !== "small")
        .slice(0, 3);

      if (!ranked.length) {
        return "No medium- or large-scale projects are visible right now, so the current filter set is mostly pulling smaller infill or maintenance-adjacent work.";
      }

      return `${ranked
        .map(
          (opportunity) =>
            `${opportunity.projectName ?? opportunity.title} (${opportunity.priorityScore}, ${formatOpportunityType(opportunity.opportunityType)})`
        )
        .join(", ")} look the most institutional because they combine scale, clearer sponsor-style context, and the strongest ranked scores in the current set.`;
    }

    if (analysisPrompt === "newest") {
      const newest = [...visibleOpportunities]
        .sort(
          (left, right) =>
            new Date(right.metadata.latestSignalDate).getTime() - new Date(left.metadata.latestSignalDate).getTime()
        )
        .slice(0, 3);

      return `${newest
        .map(
          (opportunity) =>
            `${opportunity.projectName ?? opportunity.title} (${opportunity.metadata.latestSignalDate})`
        )
        .join(", ")} are the newest visible signals, so they are the best read if you want the freshest market motion first.`;
    }

    if (analysisPrompt === "early-stage") {
      const early = visibleOpportunities.filter(
        (opportunity) =>
          opportunity.developmentStage === "early_signal" ||
          opportunity.developmentStage === "pre_construction"
      );

      if (!early.length) {
        return "Nothing in the current filtered set is reading as early-stage right now; the visible opportunities are mostly later execution or disruption signals.";
      }

      return `${early
        .slice(0, 4)
        .map((opportunity) => opportunity.projectName ?? opportunity.title)
        .join(", ")} are the clearest early-stage reads because they still sit in parcel-control, staging, or pre-construction territory rather than obvious active execution.`;
    }

    const changed = visibleOpportunities
      .filter((opportunity) => opportunity.timeline.length > 1)
      .sort((left, right) => right.timeline.length - left.timeline.length)
      .slice(0, 3);

    if (!changed.length) {
      return "The currently visible opportunities are mostly single-event signals, so there is not much timeline progression to call out inside this filter set.";
    }

    return `${changed
      .map(
        (opportunity) =>
          `${opportunity.projectName ?? opportunity.title} (${opportunity.timeline.length} timeline events)`
      )
      .join(", ")} show the most progression so far, which makes them the best candidates if you want to talk about what changed over time rather than just what appeared.`;
  }, [analysisPrompt, visibleOpportunities]);

  return (
    <div className="stack">
      <div className="panel feed-controls-panel">
        <div className="section-header panel-header">
          <div>
            <p className="eyebrow">Explorer</p>
            <h3 className="section-title">Browse the full ranked launch-market set</h3>
          </div>
          <div className="subtle-text feed-heading-meta">
            {visibleOpportunities.length} shown of {opportunities.length} ranked opportunities
          </div>
        </div>

        <div className="feed-filter-grid">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Project, city, tag, or thesis"
              type="search"
              value={filters.search}
            />
          </label>

          <label className="field">
            <span className="field-label">City</span>
            <select
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({ ...current, city: event.target.value }))
              }
              value={filters.city}
            >
              <option value="all">All cities</option>
              {filterOptions.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Opportunity type</span>
            <select
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  opportunityType: event.target.value as FeedFilterState["opportunityType"],
                }))
              }
              value={filters.opportunityType}
            >
              <option value="all">All types</option>
              {filterOptions.opportunityTypes.map((type) => (
                <option key={type} value={type}>
                  {formatOpportunityType(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Confidence</span>
            <select
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  confidence: event.target.value as FeedFilterState["confidence"],
                }))
              }
              value={filters.confidence}
            >
              <option value="all">All confidence</option>
              {filterOptions.confidenceLevels.map((level) => (
                <option key={level} value={level}>
                  {formatConfidenceLevel(level)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Stage</span>
            <select
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  stage: event.target.value as FeedFilterState["stage"],
                }))
              }
              value={filters.stage}
            >
              <option value="all">All stages</option>
              {filterOptions.stages.map((stage) => (
                <option key={stage} value={stage}>
                  {formatDevelopmentStage(stage)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Score band</span>
            <select
              className="field-input"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  scoreBand: event.target.value as FeedFilterState["scoreBand"],
                }))
              }
              value={filters.scoreBand}
            >
              <option value="all">All score bands</option>
              {filterOptions.priorityBands.map((band) => (
                <option key={band} value={band}>
                  {formatPriorityBand(band)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="feed-filter-footer">
          <div className="mini-grid feed-mini-grid">
            <div className="mini-metric">
              <strong>{mix.development}</strong>
              <span>Development</span>
            </div>
            <div className="mini-metric">
              <strong>{mix.repositioning}</strong>
              <span>Repositioning</span>
            </div>
            <div className="mini-metric">
              <strong>{mix.distress}</strong>
              <span>Distress</span>
            </div>
            <div className="mini-metric">
              <strong>{mix.residentialInfill}</strong>
              <span>Infill</span>
            </div>
          </div>

          {hasActiveFilters ? (
            <button
              className="button button-secondary"
              onClick={() => setFilters(defaultFilters)}
              type="button"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      {visibleOpportunities.length ? (
        <>
          <div className="panel feed-analysis-panel">
            <div className="section-header panel-header">
              <div>
                <p className="eyebrow">Ask the set</p>
                <h3 className="section-title">Guided questions over the visible opportunities</h3>
              </div>
            </div>

            <div className="chip-row">
              <button
                className={`chip chip-button${analysisPrompt === "institutional" ? " chip-accent" : ""}`}
                onClick={() => setAnalysisPrompt("institutional")}
                type="button"
              >
                Most institutional
              </button>
              <button
                className={`chip chip-button${analysisPrompt === "newest" ? " chip-accent" : ""}`}
                onClick={() => setAnalysisPrompt("newest")}
                type="button"
              >
                Newest signals
              </button>
              <button
                className={`chip chip-button${analysisPrompt === "early-stage" ? " chip-accent" : ""}`}
                onClick={() => setAnalysisPrompt("early-stage")}
                type="button"
              >
                Early-stage
              </button>
              <button
                className={`chip chip-button${analysisPrompt === "changed" ? " chip-accent" : ""}`}
                onClick={() => setAnalysisPrompt("changed")}
                type="button"
              >
                Changed most
              </button>
            </div>

            <p className="analysis-response">{analysisSummary}</p>
          </div>

          <div className="feed">
            {visibleOpportunities.map((opportunity) => (
              <SignalCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </>
      ) : (
        <div className="panel empty-state-inline">
          <p className="eyebrow">No matches</p>
          <h3 className="section-title">No opportunities match these filters</h3>
          <p className="tight-copy">
            Try widening the city, confidence, or score-band filters to bring more of the ranked set back into view.
          </p>
        </div>
      )}
    </div>
  );
}
