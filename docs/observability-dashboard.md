# Observability Dashboard

## Customer Problem

Enterprise buyers need to know Build Signals can be operated, debugged, and trusted after deployment.
The product already generates AI outputs, ingests public records, runs evals, and stores audit events;
the missing layer is a single operational view that shows whether those workflows are healthy.

## Architecture Decision

The observability dashboard aggregates existing first-party telemetry:

- Copilot runs
- multi-agent research runs
- ingestion runs
- AI eval runs
- audit events
- database readiness

It also adds `observability_incidents` so admins can record open operational risks that should be
resolved or disclosed before enterprise demos. The dashboard is available at `/admin/observability`
and the API is available at `/api/admin/observability`.

## Tradeoffs Considered

- First-party observability before external vendor integration. This keeps the portfolio project easy
  to run locally and gives us deterministic tests.
- Aggregated workflow health instead of per-request tracing. The next module can add event-driven
  traces, but the immediate customer value is knowing whether critical workflows are failing.
- Incident records are intentionally simple. They capture severity, source, status, timing, summary,
  and metadata without turning v1 into PagerDuty.

## Scaling Path To 1 Million Opportunities

At scale, workflow metrics should be materialized into time-bucketed aggregates rather than scanning
raw run tables. The production path is:

1. Emit structured events for every critical workflow transition.
2. Roll events into minute/hour/day aggregates by workspace, market, model, and workflow.
3. Store traces and error exemplars separately from aggregate metrics.
4. Push severe incidents to external alerting systems.
5. Keep the admin dashboard backed by aggregate tables so it remains fast at 1M opportunities.
