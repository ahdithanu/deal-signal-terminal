import Link from "next/link";
import { redirect } from "next/navigation";

import { PilotRequestForm } from "@/components/pilot-request-form";
import { getAuthSession } from "@/lib/auth";

export default async function PilotPage() {
  const session = await getAuthSession();

  if (session) {
    redirect("/?demo=1");
  }

  return (
    <div className="page-stack">
      <section className="hero hero-terminal">
        <div className="hero-panel hero-primary hero-primary-terminal">
          <p className="eyebrow">Founder-led pilot</p>
          <h1 className="hero-title">Put Build Signals in front of a real acquisitions workflow.</h1>
          <p className="hero-copy hero-copy-strong">
            The pilot is designed for teams that want earlier visibility into development motion
            without waiting for brokers, marketed processes, or spreadsheet-heavy permit review.
          </p>

          <div className="hero-callout demo-run-callout">
            <strong>Best fit right now</strong>
            <span>
              Small and mid-sized acquisitions or development teams that want a focused pilot in a
              curated launch market before broader rollout.
            </span>
          </div>

          <div className="hero-action-row">
            <Link className="button" href="#pilot-request">
              Request pilot access
            </Link>
            <Link className="button button-secondary" href="/demo">
              View live demo
            </Link>
          </div>
        </div>

        <div className="hero-side-stack">
          <div className="hero-side-panel hero-side-panel-dark">
            <p className="eyebrow eyebrow-inverse">What a pilot includes</p>
            <h2 className="hero-side-title">One market, one workflow, one accountable partner</h2>
            <p className="hero-side-copy">
              The current pilot is intentionally narrow: one launch market, founder-led setup,
              weekly feedback loops, and rapid iteration around a real sourcing workflow.
            </p>
          </div>

          <div className="hero-side-panel">
            <p className="eyebrow">Pilot timeline</p>
            <ol className="demo-steps">
              <li>Intro call and sourcing workflow fit check.</li>
              <li>Launch-market demo and pilot setup.</li>
              <li>Two to four weeks of live usage and weekly feedback.</li>
              <li>Decision on expansion, admin controls, and deeper data coverage.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="pilot-grid">
        <div className="panel">
          <p className="eyebrow">Who it&apos;s for</p>
          <h2 className="section-title">The current product is best for teams that source proactively</h2>
          <div className="demo-summary-grid">
            <div className="demo-summary-card">
              <span className="copy-label">Acquisitions</span>
              <p>Teams that want an earlier read on projects before they become broadly marketed.</p>
            </div>
            <div className="demo-summary-card">
              <span className="copy-label">Development</span>
              <p>Operators who want a tighter weekly view of nearby competitive and adjacent activity.</p>
            </div>
            <div className="demo-summary-card">
              <span className="copy-label">Research</span>
              <p>Firms that need permit motion translated into ranked signals instead of raw permit dumps.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Pilot scope</p>
          <h2 className="section-title">What you get in the first engagement</h2>
          <ul className="plain-list">
            <li>Ranked permit-driven opportunities in the El Dorado County West Slope launch market.</li>
            <li>Parcel context, source discipline, watchlist tracking, memo generation, and AI-powered Q&amp;A.</li>
            <li>Founder-led onboarding and weekly product feedback loops.</li>
            <li>A practical path from pilot validation to broader deployment and infrastructure hardening.</li>
          </ul>
        </div>

        <div className="panel">
          <p className="eyebrow">What comes next</p>
          <h2 className="section-title">The enterprise roadmap is already defined</h2>
          <ul className="plain-list">
            <li>Managed Postgres and stronger production data infrastructure.</li>
            <li>Deeper admin controls, role hardening, and better organization management.</li>
            <li>Expanded market coverage and a more durable ingestion architecture.</li>
            <li>Further security, observability, and deployment maturity for scaled customers.</li>
          </ul>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Why this approach works</p>
        <h2 className="section-title">Pilot first, then harden the platform underneath the workflow</h2>
        <p className="tight-copy">
          The current goal is not to pretend the product is fully enterprise-complete. It is to
          prove workflow value with the right teams quickly, then use live buyer feedback to drive
          the highest-value enterprise investments in data infrastructure, identity, and controls.
        </p>
        <div className="hero-action-row">
          <Link className="button" href="#pilot-request">
            Start a pilot conversation
          </Link>
          <Link className="button button-secondary" href="/api/auth/demo?redirect=/?demo=1">
            Open the seeded workspace
          </Link>
        </div>
      </section>

      <section className="stack" id="pilot-request">
        <PilotRequestForm />
      </section>
    </div>
  );
}
