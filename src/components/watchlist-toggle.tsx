"use client";

import { useWatchlist, type WatchlistSnapshot } from "@/components/watchlist-provider";

export function WatchlistToggle({
  opportunityId,
  snapshot,
  savedLabel = "Saved",
  unsavedLabel = "Watchlist",
}: {
  opportunityId: string;
  snapshot?: WatchlistSnapshot;
  savedLabel?: string;
  unsavedLabel?: string;
}) {
  const { has, isReady, toggle } = useWatchlist();
  const isSaved = isReady && has(opportunityId);

  return (
    <button
      className={`watch-button${isSaved ? " watch-button-saved" : ""}`}
      onClick={() => toggle(opportunityId, snapshot)}
      type="button"
    >
      {isSaved ? savedLabel : unsavedLabel}
    </button>
  );
}
