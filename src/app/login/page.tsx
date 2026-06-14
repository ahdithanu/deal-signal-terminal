import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getAuthSession, getDemoWorkspaceCredentials } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAuthSession();
  const demoCredentials = getDemoWorkspaceCredentials();

  if (session) {
    redirect("/");
  }

  return (
    <div className="page-stack">
      <section className="login-shell panel">
        <div className="login-copy">
          <p className="eyebrow">Protected access</p>
          <h1 className="detail-title">Sign in to Build Signals</h1>
          <p className="tight-copy">
            Use the live workspace to review ranked opportunities, test the AI-assisted sourcing
            workflow, and evaluate whether the product fits your team&apos;s acquisitions process.
          </p>

          <div className="login-guide">
            <div className="login-guide-panel">
              <p className="copy-label">Best demo path</p>
              <ol className="demo-steps">
                <li>Open the seeded workspace.</li>
                <li>Review the top-ranked opportunity and why it matters.</li>
                <li>Open the memo and watchlist to see the workflow end to end.</li>
              </ol>
            </div>

            {demoCredentials ? (
              <div className="login-guide-panel login-guide-panel-accent">
                <p className="copy-label">Demo workspace</p>
                <h2 className="login-guide-title">{demoCredentials.orgName}</h2>
                <p className="tight-copy">
                  Use the one-click entry below, or sign in manually with the seeded credentials if
                  you want to show the login flow.
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

            <div className="login-guide-panel">
              <p className="copy-label">Looking at this commercially?</p>
              <h2 className="login-guide-title">Start with the pilot path</h2>
              <p className="tight-copy">
                If the workflow looks relevant to your team, the next step is a narrow founder-led
                pilot in the first coverage set before broader rollout.
              </p>
              <a className="button button-secondary" href="/pilot">
                See pilot details
              </a>
            </div>
          </div>
        </div>

        <LoginForm demoCredentials={demoCredentials} />
      </section>
    </div>
  );
}
