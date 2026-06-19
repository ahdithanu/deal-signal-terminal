import { redirect } from "next/navigation";

import { HomeFeedExplorer } from "@/components/home-feed-explorer";
import { SignalCard } from "@/components/signal-card";
import { getCoverageSummary } from "@/data/coverage";
import { getAuthSession } from "@/lib/auth";
import { getOpportunities } from "@/lib/opportunity-service";
import {
  shouldSurfaceInHomeFeed,
  getMarketById,
} from "@/lib/opportunities";

const coverageSummary = getCoverageSummary();

export const dynamic = "force-dynamic";

export default async function HomePage({
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

  const rankedExplorerFeed = await getOpportunities();
  const homeFeed = rankedExplorerFeed.filter(shouldSurfaceInHomeFeed).slice(0, 3);
  const activeMarketIds = Array.from(
    new Set(rankedExplorerFeed.map((opportunity) => opportunity.marketId))
  );
  const activeMarkets = activeMarketIds.map(getMarketById);
  const recordsScanned = activeMarkets.reduce((sum, market) => sum + market.recordsScanned, 0);
  const featuredOpportunity = homeFeed[0];

  const opportunityMix = {
    development: rankedExplorerFeed.filter((item) => item.opportunityType === "development").length,
    repositioning: rankedExplorerFeed.filter((item) => item.opportunityType === "repositioning").length,
    leasing: rankedExplorerFeed.filter((item) => item.opportunityType === "leasing").length,
    distress: rankedExplorerFeed.filter((item) => item.opportunityType === "distress").length,
  };

  return (
    <div className="page-stack">
      <section className="hero hero-terminal">
        <div className="hero-panel hero-primary hero-primary-terminal">
          <p className="eyebrow">Developer-grade public-record intelligence</p>
          <h1 className="hero-title">See site motion before it turns into a marketed deal.</h1>
          <p className="hero-copy hero-copy-strong">
            Build Signals turns permit and approval noise across launch markets into a short
            development queue with real parcel context, ranked urgency, and an explicit next move
            for acquisitions teams.
          </p>

          <div className="hero-action-row">
            <a className="button" href="#feed">
              Review this week&apos;s queue
            </a>
            <a className="button button-secondary" href="/watchlist">
              Open watchlist
            </a>
          </div>

          {isDemoRun ? (
            <div className="hero-callout demo-run-callout">
              <strong>Demo run active</strong>
              <span>
                You&apos;re inside the seeded workspace. Use the guided path below to move from the
                top signal to memo output and watchlist changes in under two minutes.
              </span>
            </div>
          ) : null}

          <div className="hero-stat-strip">
            <div className="hero-stat">
              <span className="hero-stat-label">Signals scanned</span>
              <strong>{recordsScanned.toLocaleString()}</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Ranked opportunities</span>
              <strong>{rankedExplorerFeed.length}</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Markets live</span>
              <strong>{coverageSummary.live}</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Expansion queue</span>
              <strong>{coverageSummary.queued + coverageSummary.evaluating}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side-stack">
          <div className="hero-side-panel hero-side-panel-dark">
            <p className="eyebrow eyebrow-inverse">Launch markets</p>
            <h2 className="hero-side-title">El Dorado + San Diego</h2>
            <p className="hero-side-copy">
              County permit activity and city development approvals are normalized into one ranked
              acquisitions workflow, with a source registry now structured for nationwide market
              expansion.
            </p>
          </div>

          <div className="hero-side-panel">
            <p className="eyebrow">How this stays useful</p>
            <ul className="plain-list plain-list-compact">
              <li>Ranks site prep, staging, demolition, land reset, and credible disruption ahead of routine work.</li>
              <li>Uses parcel facts and ownership context to anchor each signal in a real site read.</li>
              <li>Writes memo drafts from sourced facts and calls out missing evidence instead of guessing.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="home-layout" id="feed">
        <div className="feed-column">
          <div className="section-header panel-header feed-heading">
            <div>
              <p className="eyebrow">This week&apos;s queue</p>
              <h2 className="section-title">Top-ranked signals worth moving on now</h2>
            </div>
            <div className="subtle-text feed-heading-meta">
              {homeFeed.length} featured leads, {rankedExplorerFeed.length} ranked opportunities in the explorer
            </div>
          </div>

          <div className="feed">
            {homeFeed.map((opportunity) => (
              <SignalCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>

          <HomeFeedExplorer opportunities={rankedExplorerFeed} />
        </div>

        <div className="sidebar-stack">
          {featuredOpportunity ? (
            <div className="panel demo-path-panel">
              <p className="eyebrow">Suggested demo path</p>
              <h3 className="section-title">Walk the strongest signal first</h3>
              <p className="tight-copy">
                Start with the highest-ranked lead, then open the memo and watchlist so the full
                workflow lands in under two minutes.
              </p>
              <div className="button-stack demo-path-actions">
                <a className="button" href={`/opportunity/${featuredOpportunity.slug}${isDemoRun ? "?demo=1" : ""}`}>
                  Open top opportunity
                </a>
                <a className="button button-secondary" href={`/memo/${featuredOpportunity.slug}${isDemoRun ? "?demo=1" : ""}`}>
                  Open IC memo
                </a>
                <a className="button button-secondary" href={`/watchlist${isDemoRun ? "?demo=1" : ""}`}>
                  Review watchlist changes
                </a>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <p className="eyebrow">Current queue</p>
            <h3 className="section-title">What made the cut</h3>
            <div className="mini-grid">
              <div className="mini-metric">
                <strong>{opportunityMix.development}</strong>
                <span>Development</span>
              </div>
              <div className="mini-metric">
                <strong>{opportunityMix.repositioning}</strong>
                <span>Repositioning</span>
              </div>
              <div className="mini-metric">
                <strong>{opportunityMix.leasing}</strong>
                <span>Leasing</span>
              </div>
              <div className="mini-metric">
                <strong>{opportunityMix.distress}</strong>
                <span>Distress</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Methodology</p>
            <h3 className="section-title">How the terminal stays disciplined</h3>
            <ul className="plain-list">
              <li>Scores favor site motion, demolition, staging, land reset, and credible disruption that can change development timing.</li>
              <li>Confidence drops when the record is thin or the development implication is still ambiguous.</li>
              <li>Cluster context can strengthen strong signals, but it does not rescue weak ones.</li>
              <li>Memo drafts use only sourced facts and call out missing facts instead of filling gaps with guesses.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
