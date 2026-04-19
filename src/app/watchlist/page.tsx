import { redirect } from "next/navigation";

import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { getAuthSession } from "@/lib/auth";
import { opportunities } from "@/lib/opportunities";

export default async function WatchlistPage() {
  const session = await getAuthSession();

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
          are now private to your authenticated workspace session instead of browser-local only.
        </p>
      </section>

      <WatchlistPageClient opportunities={opportunities} />
    </div>
  );
}
