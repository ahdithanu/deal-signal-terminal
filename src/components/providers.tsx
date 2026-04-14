"use client";

import { WatchlistProvider } from "@/components/watchlist-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <WatchlistProvider>{children}</WatchlistProvider>;
}
