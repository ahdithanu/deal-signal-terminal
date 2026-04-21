"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="page">
          <div className="page-stack">
            <section className="panel error-shell">
              <p className="eyebrow">Application error</p>
              <h1 className="detail-title">Build Signals could not render this request.</h1>
              <p className="tight-copy">
                The app hit a global error boundary. Retry once, and if it repeats, inspect the
                server logs and deployment health checks.
              </p>
              <div className="hero-action-row">
                <button className="button" onClick={reset} type="button">
                  Retry
                </button>
              </div>
            </section>
          </div>
        </div>
      </body>
    </html>
  );
}
