"use client";

import { SignalCard } from "@/components/signal-card";
import { useWatchlist } from "@/components/watchlist-provider";
import { formatDate, formatPermitTimelineStage } from "@/lib/formatters";
import type { Opportunity } from "@/types/domain";

export function WatchlistPageClient({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  const { getEntry, getSavedAt, has, isReady, watchlistIds } = useWatchlist();

  if (!isReady) {
    return (
      <div className="panel">
        <p className="eyebrow">Watchlist</p>
        <h2 className="section-title">Loading saved opportunities</h2>
      </div>
    );
  }

  const saved = opportunities.filter((opportunity) => has(opportunity.id));

  if (watchlistIds.length === 0 || saved.length === 0) {
    return (
      <div className="empty-state">
        <p className="eyebrow">Watchlist</p>
        <h2 className="section-title">No saved opportunities yet</h2>
        <p>
          Save signals from the home feed or a detail page. Watchlist entries now persist on the
          server for this session so the queue survives browser resets and local storage drift.
        </p>
      </div>
    );
  }

  return (
    <div className="feed">
      {saved.map((opportunity) => {
        const savedAt = getSavedAt(opportunity.id);
        const entry = getEntry(opportunity.id);
        const snapshot = entry?.snapshot;
        const updates = savedAt
          ? opportunity.timeline.filter(
              (entry) => new Date(entry.date).getTime() > new Date(savedAt).getTime()
            )
          : [];
        const latestTimelineDate = opportunity.timeline[opportunity.timeline.length - 1]?.date ?? null;
        const hasUpdateSinceSave =
          !!savedAt &&
          !!latestTimelineDate &&
          new Date(latestTimelineDate).getTime() > new Date(savedAt).getTime();
        const latestUpdate = updates[updates.length - 1];
        const changeSummary =
          updates.length === 0
            ? null
            : updates.length === 1 && latestUpdate
              ? `New ${formatPermitTimelineStage(latestUpdate.stage).toLowerCase()} event on ${formatDate(
                  latestUpdate.date
                )}`
              : `${updates.length} new permit events since ${formatDate(savedAt)}`;

        const scoreDelta = snapshot
          ? opportunity.priorityScore - snapshot.priorityScore
          : 0;
        const confidenceChanged = snapshot
          ? opportunity.confidenceLevel !== snapshot.confidenceLevel
          : false;
        const stageChanged = snapshot
          ? opportunity.developmentStage !== snapshot.developmentStage
          : false;
        const intelNotes = [
          scoreDelta !== 0
            ? `Priority ${scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}`
            : null,
          confidenceChanged
            ? `Confidence ${snapshot?.confidenceLevel} → ${opportunity.confidenceLevel}`
            : null,
          stageChanged
            ? `Stage ${snapshot?.developmentStage.replace("_", " ")} → ${opportunity.developmentStage.replace("_", " ")}`
            : null,
        ].filter((note): note is string => Boolean(note));

        return (
          <SignalCard
            compact
            key={opportunity.id}
            opportunity={opportunity}
            watchlistStatus={{
              savedAt,
              hasUpdateSinceSave,
              changeSummary,
              intelNotes,
            }}
          />
        );
      })}
    </div>
  );
}
