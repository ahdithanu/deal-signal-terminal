"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <div className="page-stack">
      <section className="panel error-shell">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="detail-title">The terminal hit an unexpected error.</h1>
        <p className="tight-copy">
          The request did not complete cleanly. You can retry the view now, and if the issue
          persists, check the server logs for the associated error details.
        </p>
        <div className="hero-action-row">
          <button className="button" onClick={reset} type="button">
            Retry
          </button>
        </div>
      </section>
    </div>
  );
}
