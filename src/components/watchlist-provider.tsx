"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ConfidenceLevel, DevelopmentStage } from "@/types/domain";

const STORAGE_KEY = "deal-signal-terminal.watchlist";

type WatchlistEntry = {
  savedAt: string;
  snapshot?: WatchlistSnapshot;
};

export type WatchlistSnapshot = {
  priorityScore: number;
  confidenceLevel: ConfidenceLevel;
  developmentStage: DevelopmentStage;
  latestTimelineDate: string | null;
};

type WatchlistContextValue = {
  isReady: boolean;
  watchlistIds: string[];
  getSavedAt: (opportunityId: string) => string | null;
  getEntry: (opportunityId: string) => WatchlistEntry | null;
  has: (opportunityId: string) => boolean;
  toggle: (opportunityId: string, snapshot?: WatchlistSnapshot) => void;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function parseWatchlistEntries(value: string | null): Record<string, WatchlistEntry> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, entryValue]) => {
        if (!entryValue || typeof entryValue !== "object") {
          return [];
        }

        const entry = entryValue as Partial<WatchlistEntry>;

        if (typeof entry.savedAt !== "string") {
          return [];
        }

        const snapshot = entry.snapshot;
        if (
          snapshot &&
          (typeof snapshot.priorityScore !== "number" ||
            (snapshot.confidenceLevel !== "high" &&
              snapshot.confidenceLevel !== "medium" &&
              snapshot.confidenceLevel !== "low") ||
            (snapshot.developmentStage !== "early_signal" &&
              snapshot.developmentStage !== "pre_construction" &&
              snapshot.developmentStage !== "active_construction" &&
              snapshot.developmentStage !== "disruption") ||
            (snapshot.latestTimelineDate !== null &&
              typeof snapshot.latestTimelineDate !== "string"))
        ) {
          return [];
        }

        return [[key, { savedAt: entry.savedAt, snapshot } as WatchlistEntry]];
      })
    );
  } catch {
    return {};
  }
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlistEntries, setWatchlistEntries] = useState<Record<string, WatchlistEntry>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      setWatchlistEntries(parseWatchlistEntries(window.localStorage.getItem(STORAGE_KEY)));
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setWatchlistEntries(parseWatchlistEntries(event.newValue));
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function toggle(opportunityId: string, snapshot?: WatchlistSnapshot) {
    setWatchlistEntries((current) => {
      const next = { ...current };

      if (next[opportunityId]) {
        delete next[opportunityId];
      } else {
        next[opportunityId] = {
          savedAt: new Date().toISOString(),
          snapshot,
        };
      }

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep the optimistic UI update even if persistence is unavailable.
      }

      return next;
    });
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
