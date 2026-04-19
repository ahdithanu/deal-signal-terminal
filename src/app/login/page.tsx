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
          <h1 className="detail-title">Sign in to Deal Signal Terminal</h1>
          <p className="tight-copy">
            This demo uses org-scoped access and server-backed persistence. Open the seeded
            workspace to review the ranked feed, jump into the strongest signal, and generate a
            memo without setup friction.
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
          </div>
        </div>

        <LoginForm demoCredentials={demoCredentials} />
      </section>
    </div>
  );
}
