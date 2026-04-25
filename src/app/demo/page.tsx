import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession, getDemoWorkspaceCredentials } from "@/lib/auth";

export default async function DemoPage() {
  const session = await getAuthSession();
  const demoCredentials = getDemoWorkspaceCredentials();

  if (session) {
    redirect("/?demo=1");
  }

  return (
    <div className="page-stack demo-page">
      <section className="hero hero-terminal">
        <div className="hero-panel hero-primary hero-primary-terminal">
          <div>
            <p className="eyebrow">Live product demo</p>
            <h1 className="hero-title">Track real development motion before it becomes a marketed deal.</h1>
            <p className="hero-copy hero-copy-strong">
              Build Signals turns public permit records into a ranked developer queue with
              parcel context, a clear “why this matters,” and a memo-ready next move.
            </p>

            <div className="hero-callout demo-run-callout">
              <strong>Best way to experience it</strong>
              <span>
                Open the seeded workspace, follow the guided flow, and move from top signal to
                memo to watchlist in under two minutes.
              </span>
            </div>
          </div>

          <div className="hero-action-row">
            <Link className="button" href="/api/auth/demo?redirect=/?demo=1">
              Open demo workspace
            </Link>
            <Link className="button button-secondary" href="/login">
              Sign in manually
            </Link>
          </div>
        </div>

        <div className="hero-side-stack">
          <div className="hero-side-panel hero-side-panel-dark">
            <p className="eyebrow eyebrow-inverse">What you&apos;ll see</p>
            <h2 className="hero-side-title">A developer workflow, not a dashboard</h2>
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
              <li>Open the IC memo draft.</li>
              <li>Finish on the watchlist intelligence view.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="home-layout">
        <div className="feed-column">
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
