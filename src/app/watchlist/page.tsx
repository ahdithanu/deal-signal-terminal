import { redirect } from "next/navigation";

import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { getAuthSession } from "@/lib/auth";
import { opportunities } from "@/lib/opportunities";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isDemoRun = resolvedSearchParams?.demo === "1";

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Saved queue</p>
        <h1 className="detail-title">Watchlist</h1>
        <p className="tight-copy">
          Keep a lightweight acquisition shortlist without turning v1 into a CRM. Saved entries
          persist to your authenticated workspace.
        </p>
        {isDemoRun ? (
          <div className="hero-callout demo-run-callout">
            <strong>End the demo here</strong>
            <span>
              This is the workflow close: a saved queue that calls out what changed since the last
              review instead of acting like a static bookmark list.
            </span>
          </div>
        ) : null}
      </section>

      <WatchlistPageClient opportunities={opportunities} />
    </div>
  );
}
