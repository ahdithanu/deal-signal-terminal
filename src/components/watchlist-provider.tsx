"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { WatchlistEntry, WatchlistSnapshot } from "@/types/domain";

type WatchlistContextValue = {
  isReady: boolean;
  watchlistIds: string[];
  getSavedAt: (opportunityId: string) => string | null;
  getEntry: (opportunityId: string) => WatchlistEntry | null;
  has: (opportunityId: string) => boolean;
  toggle: (opportunityId: string, snapshot?: WatchlistSnapshot) => void;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function isWatchlistSnapshot(value: unknown): value is WatchlistSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<WatchlistSnapshot>;
  return (
    typeof snapshot.priorityScore === "number" &&
    (snapshot.confidenceLevel === "high" ||
      snapshot.confidenceLevel === "medium" ||
      snapshot.confidenceLevel === "low") &&
    (snapshot.developmentStage === "early_signal" ||
      snapshot.developmentStage === "pre_construction" ||
      snapshot.developmentStage === "active_construction" ||
      snapshot.developmentStage === "disruption") &&
    (snapshot.latestTimelineDate === null || typeof snapshot.latestTimelineDate === "string")
  );
}

function parseWatchlistEntries(value: unknown): Record<string, WatchlistEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (!entryValue || typeof entryValue !== "object") {
        return [];
      }

      const entry = entryValue as Partial<WatchlistEntry>;

      if (typeof entry.savedAt !== "string") {
        return [];
      }

      if (entry.snapshot && !isWatchlistSnapshot(entry.snapshot)) {
        return [];
      }

      return [[key, { savedAt: entry.savedAt, snapshot: entry.snapshot }]];
    })
  );
}

async function loadWatchlistEntries(): Promise<Record<string, WatchlistEntry>> {
  const response = await fetch("/api/user-state", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load watchlist.");
  }

  const state = (await response.json()) as { watchlist?: unknown };
  return parseWatchlistEntries(state.watchlist);
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlistEntries, setWatchlistEntries] = useState<Record<string, WatchlistEntry>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    loadWatchlistEntries()
      .then((entries) => {
        if (isActive) {
          setWatchlistEntries(entries);
        }
      })
      .catch(() => {
        if (isActive) {
          setWatchlistEntries({});
        }
      })
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function toggle(opportunityId: string, snapshot?: WatchlistSnapshot) {
    const currentEntry = watchlistEntries[opportunityId];
    const previousEntries = watchlistEntries;

    const optimisticEntries = { ...watchlistEntries };

    if (currentEntry) {
      delete optimisticEntries[opportunityId];
    } else {
      optimisticEntries[opportunityId] = {
        savedAt: new Date().toISOString(),
        snapshot,
      };
    }

    setWatchlistEntries(optimisticEntries);

    try {
      const response = await fetch(
        currentEntry
          ? `/api/watchlist?opportunityId=${encodeURIComponent(opportunityId)}`
          : "/api/watchlist",
        {
          method: currentEntry ? "DELETE" : "POST",
          headers: currentEntry
            ? undefined
            : {
                "Content-Type": "application/json",
              },
          body: currentEntry
            ? undefined
            : JSON.stringify({
                opportunityId,
                snapshot,
              }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save watchlist.");
      }

      setWatchlistEntries(parseWatchlistEntries(await response.json()));
    } catch {
      setWatchlistEntries(previousEntries);
    }
  }

  const value = {
    isReady,
    watchlistIds: Object.keys(watchlistEntries),
    getSavedAt: (opportunityId: string) => watchlistEntries[opportunityId]?.savedAt ?? null,
    getEntry: (opportunityId: string) => watchlistEntries[opportunityId] ?? null,
    has: (opportunityId: string) => Boolean(watchlistEntries[opportunityId]),
    toggle,
  };

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);

  if (!context) {
    throw new Error("useWatchlist must be used inside WatchlistProvider");
  }

  return context;
}
