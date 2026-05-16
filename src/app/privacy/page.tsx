export default function PrivacyPage() {
  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Privacy</p>
        <h1 className="detail-title">Build Signals privacy overview</h1>
        <p className="tight-copy">
          Build Signals is currently offered as a founder-led pilot product. We collect the
          minimum data needed to operate the app, support pilot requests, and improve the product
          for customer workflows.
        </p>
      </section>

      <section className="detail-layout">
        <div className="stack">
          <div className="panel">
            <p className="eyebrow">What we collect</p>
            <h2 className="section-title">Operational product data</h2>
            <ul className="plain-list">
              <li>Account details such as name, email, organization, and role for authenticated users.</li>
              <li>Workspace activity such as watchlist saves, notes, and pilot request submissions.</li>
              <li>AI question prompts and memo-generation inputs needed to produce in-app outputs.</li>
            </ul>
          </div>

          <div className="panel">
            <p className="eyebrow">How we use it</p>
            <h2 className="section-title">Product operation and pilot support</h2>
            <ul className="plain-list">
              <li>To authenticate users and preserve organization-scoped workspace state.</li>
              <li>To review pilot requests and respond to commercial inquiries.</li>
              <li>To generate memo drafts, AI answers, and audit activity needed to operate the platform safely.</li>
            </ul>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <p className="eyebrow">Storage and security</p>
            <h3 className="section-title">Current deployment posture</h3>
            <ul className="plain-list">
              <li>User and pilot data are stored in the app&apos;s server-side persistence layer.</li>
              <li>Authentication cookies are set as HTTP-only and same-site to reduce client-side exposure.</li>
              <li>Security headers and route-level rate limits are applied to reduce abuse risk.</li>
            </ul>
          </div>

          <div className="panel">
            <p className="eyebrow">Contact</p>
            <h3 className="section-title">Questions or deletion requests</h3>
            <p className="tight-copy">
              For pilot-stage privacy questions, data deletion requests, or commercial diligence,
              contact <a href="mailto:hello@buildsignals.ai">hello@buildsignals.ai</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
