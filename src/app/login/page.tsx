import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getAuthSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getAuthSession();

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
            This environment now uses org-scoped access and server-backed persistence. Sign in with
            your organization credentials to open the feed, watchlist, and memos.
          </p>
        </div>

        <LoginForm />
      </section>
    </div>
  );
}
