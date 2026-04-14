import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { opportunities } from "@/lib/opportunities";

export default function WatchlistPage() {
  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Saved queue</p>
        <h1 className="detail-title">Watchlist</h1>
        <p className="tight-copy">
          Keep a lightweight acquisition shortlist without turning v1 into a CRM. Saved entries
          stay local to this browser session.
        </p>
      </section>

      <WatchlistPageClient opportunities={opportunities} />
    </div>
  );
}
