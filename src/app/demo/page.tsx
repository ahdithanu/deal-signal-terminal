import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession, getDemoWorkspaceCredentials } from "@/lib/auth";
import { formatOpportunityType } from "@/lib/formatters";
import { getOpportunities } from "@/lib/opportunity-service";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const session = await getAuthSession();
  const demoCredentials = getDemoWorkspaceCredentials();
  const opportunities = await getOpportunities();
  const mostInstitutional = opportunities
    .filter((opportunity) => opportunity.projectScale !== "small")
    .slice(0, 3);
  const newestSignals = [...opportunities]
    .sort(
      (left, right) =>
        new Date(right.metadata.latestSignalDate).getTime() -
        new Date(left.metadata.latestSignalDate).getTime()
    )
    .slice(0, 3);
  const earlyStage = opportunities
    .filter(
      (opportunity) =>
        opportunity.developmentStage === "early_signal" ||
        opportunity.developmentStage === "pre_construction"
    )
    .slice(0, 4);
  const changedMost = [...opportunities]
    .filter((opportunity) => opportunity.timeline.length > 1)
    .sort((left, right) => right.timeline.length - left.timeline.length)
    .slice(0, 3);

  if (session) {
    redirect("/?demo=1");
  }

  return (
    <div className="page-stack demo-page">
      <section className="hero hero-terminal">
        <div className="hero-panel hero-primary hero-primary-terminal">
          <div>
            <p className="eyebrow">Live product demo</p>
            <h1 className="hero-title">Help acquisitions teams see meaningful development signals before the market does.</h1>
            <p className="hero-copy hero-copy-strong">
              Build Signals turns fragmented public permit and approval activity into a ranked
              sourcing pipeline with parcel context, investment framing, and a memo-ready next move.
            </p>

            <div className="hero-callout demo-run-callout">
              <strong>Why teams care</strong>
              <span>
                The goal is simple: reduce sourcing noise, identify projects earlier, and help a
                team move from raw public-record motion to a usable pipeline view in minutes,
                with a source model designed to expand market by market.
              </span>
            </div>
          </div>

          <div className="hero-action-row">
            <Link className="button" href="/api/auth/demo?redirect=/?demo=1">
              Open demo workspace
            </Link>
            <Link className="button button-secondary" href="/pilot">
              Request pilot access
            </Link>
            <Link className="button button-secondary" href="/login">
              Sign in
            </Link>
          </div>
        </div>

        <div className="hero-side-stack">
          <div className="hero-side-panel hero-side-panel-dark">
            <p className="eyebrow eyebrow-inverse">What you&apos;ll see</p>
            <h2 className="hero-side-title">A sourcing workflow, not a spreadsheet</h2>
            <p className="hero-side-copy">
              The demo walks through the ranked feed, a diligence-grade opportunity page, a memo
              draft, and a watchlist that highlights what changed since the last review.
            </p>
          </div>

          <div className="hero-side-panel">
            <p className="eyebrow">Demo path</p>
            <ol className="demo-steps">
              <li>Open the seeded workspace.</li>
              <li>Review the top-ranked opportunity.</li>
              <li>Use filters and AI questions across the ranked set.</li>
              <li>Open the IC memo draft.</li>
              <li>Finish on the watchlist intelligence view.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="home-layout">
        <div className="feed-column">
          <div className="panel">
            <p className="eyebrow">Who it&apos;s for</p>
            <h2 className="section-title">Built for teams that source proactively</h2>
            <div className="demo-summary-grid">
              <div className="demo-summary-card">
                <span className="copy-label">Acquisitions teams</span>
                <p>Earlier visibility into real project motion before a deal is broadly marketed.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Developers</span>
                <p>Weekly visibility into nearby competitive activity, site prep, and pre-construction signals.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Research and strategy</span>
                <p>Permit intelligence translated into ranked opportunities instead of raw permit noise.</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Why teams buy</p>
            <h2 className="section-title">The commercial value is speed and signal quality</h2>
            <div className="demo-summary-grid">
              <div className="demo-summary-card">
                <span className="copy-label">See deals earlier</span>
                <p>Identify meaningful development motion before it shows up in a marketed process.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Reduce sourcing noise</span>
                <p>Rank and filter permit activity so teams spend time on the few signals that matter.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Move faster internally</span>
                <p>Turn a raw signal into a diligence-grade read and memo-ready next step quickly.</p>
              </div>
            </div>
          </div>

          <div className="panel feed-analysis-panel">
            <p className="eyebrow">AI insights preview</p>
            <h2 className="section-title">Ask Build Signals what matters across the live set</h2>
            <p className="tight-copy">
              Inside the workspace, these guided prompts update against the visible ranked set so
              you can move from raw permit and approval motion to a usable market read faster.
            </p>

            <div className="chip-row">
              <span className="chip chip-accent">Most institutional</span>
              <span className="chip">Newest signals</span>
              <span className="chip">Early-stage</span>
              <span className="chip">Changed most</span>
            </div>

            <p className="analysis-response">
              {mostInstitutional
                .map(
                  (opportunity) =>
                    `${opportunity.projectName ?? opportunity.title} (${opportunity.priorityScore}, ${formatOpportunityType(opportunity.opportunityType)})`
                )
                .join(", ")}{" "}
              look the most institutional because they combine scale, clearer sponsor-style
              context, and the strongest ranked scores in the current set.
            </p>

            <div className="demo-summary-grid">
              <div className="demo-summary-card">
                <span className="copy-label">Newest signals</span>
                <p>
                  {newestSignals
                    .map(
                      (opportunity) =>
                        `${opportunity.projectName ?? opportunity.title} (${opportunity.metadata.latestSignalDate})`
                    )
                    .join(", ")}
                </p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Early-stage</span>
                <p>
                  {earlyStage
                    .map((opportunity) => opportunity.projectName ?? opportunity.title)
                    .join(", ")}
                </p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Changed most</span>
                <p>
                  {changedMost
                    .map(
                      (opportunity) =>
                        `${opportunity.projectName ?? opportunity.title} (${opportunity.timeline.length} timeline events)`
                    )
                    .join(", ")}
                </p>
              </div>
            </div>
          </div>

          <div className="panel demo-summary-panel">
            <p className="eyebrow">Why it stands out</p>
            <h2 className="section-title">This is built for real acquisitions judgment</h2>
            <div className="demo-summary-grid">
              <div className="demo-summary-card">
                <span className="copy-label">Signals</span>
                <p>Public permit motion is normalized into ranked opportunities instead of a spreadsheet dump.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Context</span>
                <p>Parcel facts and ownership cues sharpen the read without pretending to know more than the record shows.</p>
              </div>
              <div className="demo-summary-card">
                <span className="copy-label">Output</span>
                <p>The memo stays fact-safe and investor-ready, so the product feels useful instead of merely interesting.</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <p className="eyebrow">Pilot path</p>
            <h2 className="section-title">Take it from live demo to founder-led pilot</h2>
            <p className="tight-copy">
              If this workflow fits your sourcing process, the next step is a narrow pilot: one
              first coverage set, one real team, weekly feedback loops, and a clear path to a
              nationwide-ready deployment.
            </p>
            <div className="hero-action-row">
              <Link className="button" href="/pilot">
                See pilot details
              </Link>
              <Link className="button button-secondary" href="/api/auth/demo?redirect=/?demo=1">
                Explore the workspace
              </Link>
            </div>
          </div>
        </div>

        <div className="sidebar-stack">
          {demoCredentials ? (
            <div className="panel demo-credentials-panel">
              <p className="eyebrow">Seeded workspace</p>
              <h3 className="section-title">{demoCredentials.orgName}</h3>
              <p className="tight-copy">
                The product can open directly into the seeded workspace, but these credentials are
                still available if you want to demonstrate the auth flow explicitly.
              </p>
              <div className="demo-credential-list">
                <div>
                  <span className="field-label">Email</span>
                  <code>{demoCredentials.email}</code>
                </div>
                <div>
                  <span className="field-label">Password</span>
                  <code>{demoCredentials.password}</code>
                </div>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <p className="eyebrow">Source discipline</p>
            <h3 className="section-title">No invented facts</h3>
            <p className="tight-copy">
              The live coverage set is grounded in official El Dorado County permit activity and
              City of San Diego development approvals, then enriched with dated parcel context
              where available rather than undocumented assumptions.
            </p>
            <ul className="plain-list">
              <li>Scores are rules-based and transparent.</li>
              <li>Memos call out missing evidence instead of guessing.</li>
              <li>The watchlist tracks change over time, not static saves.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
